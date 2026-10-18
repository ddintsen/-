import { Component, memo, useEffect, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
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
function BackgroundScene({ dark }: { dark: boolean }) {
  const { camera, gl, invalidate } = useThree();
  useEffect(() => {
    camera.lookAt(0.35, 1.45, -4);
    gl.setClearColor(dark ? colors["space-night"] : colors["space-light"], 1);
    gl.domElement.dataset.spaceReady = "true";
    invalidate();
  }, [camera, gl, dark, invalidate]);
  return <SpaceEnvironment dark={dark} />;
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
