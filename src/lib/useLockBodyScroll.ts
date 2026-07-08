import { useLayoutEffect } from 'react';

// Every full-screen `fixed inset-0` overlay (ChallengeModal, ProfileModal,
// Podium) left the page behind it scrollable. Nothing stopped a mouse wheel /
// touch drag from scrolling the arena underneath, which combined with
// backdrop-blur is a known trigger for stale, un-blurred gaps of page content
// showing through mid-scroll on some browsers/GPUs — and just felt like a
// broken, unresponsive modal regardless. This locks <body> scroll for as long
// as any caller is mounted, restoring the previous value on unmount.
export default function useLockBodyScroll() {
  useLayoutEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
}
