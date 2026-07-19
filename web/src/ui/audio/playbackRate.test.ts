import { afterEach, beforeEach, expect, suite, test, vi } from "vitest"
import {
	DEFAULT_PLAYBACK_RATE, PLAYBACK_RATES, formatPlaybackRate, loadPlaybackRate, nextPlaybackRate, savePlaybackRate,
} from "./AudioPlayerContext.ts"

const makeLocalStorage = () => {
	const store = new Map<string, string>()
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => void store.set(key, value),
		removeItem: (key: string) => void store.delete(key),
		clear: () => store.clear(),
	}
}

suite("nextPlaybackRate", () => {
	test("cycles through every rate in order", () => {
		let rate: number = PLAYBACK_RATES[0]
		const seen: number[] = [rate]
		for (let i = 0; i < PLAYBACK_RATES.length - 1; i++) {
			rate = nextPlaybackRate(rate)
			seen.push(rate)
		}
		expect(seen).toEqual([...PLAYBACK_RATES])
	})

	test("wraps around to the first rate", () => {
		expect(nextPlaybackRate(PLAYBACK_RATES[PLAYBACK_RATES.length - 1])).toBe(PLAYBACK_RATES[0])
	})

	test("falls back to the first rate for unknown values", () => {
		// indexOf returns -1, so (-1 + 1) % len === 0
		expect(nextPlaybackRate(3.7)).toBe(PLAYBACK_RATES[0])
	})
})

suite("formatPlaybackRate", () => {
	test("renders integral and fractional rates", () => {
		expect(formatPlaybackRate(1)).toBe("1×")
		expect(formatPlaybackRate(1.25)).toBe("1.25×")
		expect(formatPlaybackRate(2)).toBe("2×")
	})
})

suite("playback rate persistence", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", makeLocalStorage())
	})
	afterEach(() => {
		vi.unstubAllGlobals()
	})

	test("defaults when nothing is stored", () => {
		expect(loadPlaybackRate()).toBe(DEFAULT_PLAYBACK_RATE)
	})

	test("round-trips a saved rate", () => {
		savePlaybackRate(1.5)
		expect(loadPlaybackRate()).toBe(1.5)
	})

	test("ignores a stored rate that isn't one of the presets", () => {
		localStorage.setItem("gomuks.audio.playbackRate", "9000")
		expect(loadPlaybackRate()).toBe(DEFAULT_PLAYBACK_RATE)
	})

	test("ignores non-numeric garbage", () => {
		localStorage.setItem("gomuks.audio.playbackRate", "fast")
		expect(loadPlaybackRate()).toBe(DEFAULT_PLAYBACK_RATE)
	})

	test("survives localStorage throwing", () => {
		vi.stubGlobal("localStorage", {
			getItem: () => {
				throw new Error("denied")
			},
			setItem: () => {
				throw new Error("denied")
			},
		})
		expect(loadPlaybackRate()).toBe(DEFAULT_PLAYBACK_RATE)
		expect(() => savePlaybackRate(1.5)).not.toThrow()
	})
})
