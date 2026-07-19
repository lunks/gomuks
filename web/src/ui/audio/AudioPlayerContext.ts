// gomuks - A Matrix client written in Go.
// Copyright (C) 2026 Tulir Asokan
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
import React, { createContext, use } from "react"
import type { MemDBEvent } from "@/api/types"

export const calculateClickPercent = (e: React.MouseEvent<HTMLElement>): number => {
	const rect = e.currentTarget.getBoundingClientRect()
	return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
}

export interface AudioMetadata {
	event: MemDBEvent
	senderMemberEvent: MemDBEvent | null
	roomName: string | null
	duration?: number
}

export interface AudioPlayerState {
	mediaURL: string | null
	isPlaying: boolean
	duration: number
	metadata: AudioMetadata | null
}

export const INITIAL_AUDIO_PLAYER_STATE: AudioPlayerState = {
	mediaURL: null,
	isPlaying: false,
	duration: 0,
	metadata: null,
}

// Playback speed is deliberately global: it applies to every audio message and persists across
// reloads, so you don't have to re-pick it for each voice message.
export const PLAYBACK_RATES = [1, 1.25, 1.5, 1.75, 2] as const

export const DEFAULT_PLAYBACK_RATE = 1

const PLAYBACK_RATE_KEY = "gomuks.audio.playbackRate"

export const loadPlaybackRate = (): number => {
	try {
		const stored = Number(localStorage.getItem(PLAYBACK_RATE_KEY))
		return PLAYBACK_RATES.includes(stored as typeof PLAYBACK_RATES[number]) ? stored : DEFAULT_PLAYBACK_RATE
	} catch {
		// localStorage can throw in private mode / with storage disabled
		return DEFAULT_PLAYBACK_RATE
	}
}

export const savePlaybackRate = (rate: number) => {
	try {
		localStorage.setItem(PLAYBACK_RATE_KEY, String(rate))
	} catch {
		// Not being able to persist the rate shouldn't break playback
	}
}

export const nextPlaybackRate = (rate: number): number => {
	const idx = PLAYBACK_RATES.indexOf(rate as typeof PLAYBACK_RATES[number])
	return PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length]
}

// 1 -> "1×", 1.25 -> "1.25×"
export const formatPlaybackRate = (rate: number): string => `${rate}×`

export interface AudioPlayerContextFields {
	state: AudioPlayerState
	play: (mediaURL: string, metadata?: AudioMetadata) => void
	pause: () => void
	resume: () => void
	seek: (time: number) => void
	close: () => void
	getAudioElement: () => HTMLAudioElement | null
	revealGlobalPlayer: () => void
	playbackRate: number
	cyclePlaybackRate: () => void
}

const AudioPlayerContext = createContext<AudioPlayerContextFields | null>(null)

export const useAudioPlayer = (): AudioPlayerContextFields => {
	const context = use(AudioPlayerContext)
	if (!context) {
		throw new Error("useAudioPlayer must be used within an AudioPlayer provider")
	}
	return context
}

export default AudioPlayerContext
