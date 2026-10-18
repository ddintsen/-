import { Component, memo, useEffect, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { colors } from "../api/model";
import { ProceduralRoom } from "./ProceduralRoom";

// A decorative renderer must never prevent access to the dashboard on devices without WebGL.
class RoomBoundary extends Component<
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
    gl.setClearColor(dark ? colors["room-night"] : colors["room-horizon"], 1);
    gl.domElement.dataset.roomReady = "true";
    invalidate();
  }, [camera, gl, dark, invalidate]);
  return <ProceduralRoom dark={dark} />;
}
const RoomBackdrop = memo(function RoomBackdrop({ dark }: { dark: boolean }) {
  return (
    <RoomBoundary>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.25]}
        camera={{ position: [0, 1.6, 0.7], fov: 68 }}
        gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
        fallback={null}
      >
        <BackgroundScene dark={dark} />
      </Canvas>
    </RoomBoundary>
  );
});
export default RoomBackdrop;
