import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import FamLoading from '../FamLoading';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('shows the silent high-five animation while loading', () => {
  vi.stubGlobal('matchMedia', () => ({ matches:false, addEventListener:vi.fn(), removeEventListener:vi.fn() }));
  const { container } = render(<FamLoading label="Loading page"/>);
  expect(screen.getByRole('status')).toHaveTextContent('Loading page');
  const video = container.querySelector('video');
  expect(video).toHaveProperty('muted', true);
  expect(video).toHaveAttribute('playsinline');
  expect(video.querySelector('source')).toHaveAttribute('src', '/animations/family-high-five.mp4');
});
it('uses a still image for reduced motion', () => {
  vi.stubGlobal('matchMedia', () => ({ matches:true, addEventListener:vi.fn(), removeEventListener:vi.fn() }));
  const { container } = render(<FamLoading/>);
  expect(container.querySelector('video')).toBeNull();
  expect(container.querySelector('img')).toHaveAttribute('src', '/animations/family-high-five-poster.png');
});
