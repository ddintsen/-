import {
  Component,
  memo,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { colors } from "../api/model";
import { SpaceEnvironment } from "./SpaceEnvironment";

// A decorative renderer must never prevent access to the dashboard on devices without WebGL.
class SpaceBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
const LOOK_FROM = new Vector3(0, 1.75, -9);
const LOOK_TO = new Vector3(0, 2.45, -9);
const INTRO_SECONDS = 2.8;
// The surface drift is a few pixels per second, so a low redraw rate stays smooth and cheap
// for the frosted glass that resamples the canvas.
const DRIFT_FPS = 12;

function BackgroundScene({ dark }: { dark: boolean }) {
  const { camera, gl, invalidate } = useThree();
  const reduced = useMemo(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const intro = useRef(reduced ? INTRO_SECONDS : 0);
  const look = useMemo(() => new Vector3(), []);
  useEffect(() => {
    gl.setClearColor(dark ? colors["space-night"] : colors["space-light"], 1);
    gl.domElement.dataset.spaceReady = "true";
    invalidate();
  }, [gl, dark, invalidate]);
  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") invalidate();
    }, 1000 / DRIFT_FPS);
    return () => window.clearInterval(timer);
  }, [reduced, invalidate]);
  // A sunrise reveal: the view lifts from the night side toward the limb once per load.
  useFrame((_, delta) => {
    const running = intro.current < INTRO_SECONDS;
    intro.current = Math.min(
      INTRO_SECONDS,
      intro.current + Math.min(delta, 0.05),
    );
    const k = 1 - Math.pow(1 - intro.current / INTRO_SECONDS, 3);
    camera.lookAt(look.lerpVectors(LOOK_FROM, LOOK_TO, k));
    if (running) invalidate();
  });
  return <SpaceEnvironment dark={dark} motion={!reduced} />;
}
const SpaceBackdrop = memo(function SpaceBackdrop({ dark }: { dark: boolean }) {
  return (
    <SpaceBoundary>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.25]}
        camera={{ position: [0, 1.6, 0.7], fov: 68 }}
        gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
        fallback={null}
      >
        <BackgroundScene dark={dark} />
      </Canvas>
    </SpaceBoundary>
  );
});
export default SpaceBackdrop;
