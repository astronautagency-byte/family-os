import { it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import VoiceNotePlayer from '../VoiceNotePlayer';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('does not autoplay and supports explicit playback, seeking and speed changes', async () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const ui = render(<VoiceNotePlayer src="https://example.test/audio" />);
  const audio = ui.container.querySelector('audio');
  expect(play).not.toHaveBeenCalled();
  Object.defineProperty(audio, 'duration', { configurable: true, value: 12 });
  fireEvent.loadedMetadata(audio);
  expect(screen.getByText('0:00 / 0:12')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Play voice note' }));
  expect(play).toHaveBeenCalledOnce();
  fireEvent.play(audio);
  expect(screen.getByRole('button', { name: 'Pause voice note' })).toBeDefined();
  fireEvent.change(screen.getByRole('slider'), { target: { value: '6' } });
  expect(audio.currentTime).toBe(6);
  fireEvent.click(screen.getByRole('button', { name: 'Playback speed 1 times' }));
  expect(audio.playbackRate).toBe(1.5);
});
it('keeps the player visible with an actionable error when audio is unavailable', () => {
  const retry = vi.fn();
  render(<VoiceNotePlayer error="Audio unavailable" onRetry={retry} />);
  expect(screen.getByRole('button', { name: 'Play voice note' }).disabled).toBe(true);
  expect(screen.getByRole('alert').textContent).toContain('Audio unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry audio' }));
  expect(retry).toHaveBeenCalledOnce();
});
