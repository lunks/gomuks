// gomuks - A Matrix client written in Go.
// Copyright (C) 2024 Tulir Asokan
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
import { RefCallback, useCallback, useState } from "react"

// Some bridges (e.g. mautrix-whatsapp) never set info.thumbnail_url on videos, which leaves
// the <video> with no poster. Combined with preload="none" that renders as a blank black box
// until the user presses play. To avoid that, grab a frame from the video itself and use it
// as the poster.
//
// Media is served from the gomuks media proxy, i.e. same-origin, so the canvas is not tainted
// and toDataURL works. Extraction is deferred until the video scrolls into view, and only a
// couple run at a time, because seeking downloads part of the file.

const posterCache = new Map<string, string>()

const MAX_CONCURRENT = 2
const LOAD_TIMEOUT_MS = 15_000
const JPEG_QUALITY = 0.6
// Seek a little into the video: the very first frame is often black.
const SEEK_FRACTION = 0.1
const SEEK_MAX_SECONDS = 1
// Start extracting slightly before the video is actually on screen.
const ROOT_MARGIN = "200px"

let activeCount = 0
const queue: (() => void)[] = []

function pump() {
	while (activeCount < MAX_CONCURRENT && queue.length > 0) {
		queue.shift()!()
	}
}

function extractPoster(src: string): Promise<string | null> {
	return new Promise(resolve => {
		queue.push(() => {
			activeCount++
			const video = document.createElement("video")
			video.preload = "auto"
			video.muted = true
			video.playsInline = true
			video.crossOrigin = "anonymous"

			let settled = false
			const finish = (poster: string | null) => {
				if (settled) {
					return
				}
				settled = true
				clearTimeout(timeout)
				// Drop the buffered data instead of leaving it pinned in memory
				video.removeAttribute("src")
				video.load()
				activeCount--
				pump()
				resolve(poster)
			}
			const timeout = setTimeout(() => finish(null), LOAD_TIMEOUT_MS)

			video.addEventListener("loadedmetadata", () => {
				const duration = isFinite(video.duration) ? video.duration : 0
				video.currentTime = Math.min(SEEK_MAX_SECONDS, duration * SEEK_FRACTION) || 0
			}, { once: true })
			video.addEventListener("seeked", () => {
				if (!video.videoWidth || !video.videoHeight) {
					finish(null)
					return
				}
				try {
					const canvas = document.createElement("canvas")
					canvas.width = video.videoWidth
					canvas.height = video.videoHeight
					canvas.getContext("2d")!.drawImage(video, 0, 0)
					finish(canvas.toDataURL("image/jpeg", JPEG_QUALITY))
				} catch (err) {
					console.warn("Failed to generate video poster", err)
					finish(null)
				}
			}, { once: true })
			video.addEventListener("error", () => finish(null), { once: true })

			video.src = src
		})
		pump()
	})
}

// useVideoPoster returns a generated poster image and a ref to attach to the video element.
// Generation is skipped entirely when enabled is false (i.e. when the event has a real thumbnail).
export function useVideoPoster(
	src: string | undefined,
	enabled: boolean,
): [string | undefined, RefCallback<HTMLVideoElement>] {
	const [poster, setPoster] = useState<string | undefined>(() =>
		src && enabled ? posterCache.get(src) : undefined)

	const ref = useCallback((node: HTMLVideoElement | null) => {
		if (!node || !src || !enabled) {
			return
		}
		const cached = posterCache.get(src)
		if (cached) {
			setPoster(cached)
			return
		}
		let cancelled = false
		const observer = new IntersectionObserver(entries => {
			if (!entries.some(entry => entry.isIntersecting)) {
				return
			}
			observer.disconnect()
			extractPoster(src).then(generated => {
				if (generated && !cancelled) {
					posterCache.set(src, generated)
					setPoster(generated)
				}
			})
		}, { rootMargin: ROOT_MARGIN })
		observer.observe(node)
		return () => {
			cancelled = true
			observer.disconnect()
		}
	}, [src, enabled])

	return [poster, ref]
}
