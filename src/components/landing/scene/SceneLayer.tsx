import { Suspense, lazy, useState } from "react";
import { useReducedMotion } from "motion/react";
import { HelixPoster } from "./HelixGlyph";

const HelixScene = lazy(() => import("./HelixScene"));

/** False without WebGL2, and on CPU rasterisers where the scene would stall the whole page. */
function canRunScene() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !/swiftshader|llvmpipe|software|basic render/i.test(renderer);
  } catch {
    return false;
  }
}

interface SceneLayerProps {
  theme: "light" | "dark";
  className?: string;
}

/** Hosts the WebGL helix. The poster stays up until the first frame, or for good without WebGL. */
export default function SceneLayer({ theme, className = "lp-scene" }: SceneLayerProps) {
  const reduced = useReducedMotion() ?? false;
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const [painted, setPainted] = useState(false);
  const [webgl] = useState(canRunScene);

  return (
    <div className={className} aria-hidden="true">
      {!painted && <HelixPoster className="lp-scene-poster" />}
      {webgl && (
        <div ref={setLayer} className="lp-scene-canvas">
          {layer && (
            <Suspense fallback={null}>
              <HelixScene theme={theme} reduced={reduced} layer={layer} onFirstFrame={() => setPainted(true)} />
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}
