import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SOURCES } from "../data/mock-profile";
import type { Forecast } from "../types/forecast";
import FlatPipeline from "./flat-pipeline";

export default function Pipeline({ forecast }: { forecast: Forecast }) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(forecast);
  latest.current = forecast;
  const updateWeights = useRef<(() => void) | null>(null);
  useEffect(() => {
    updateWeights.current?.();
  }, [forecast]);
  const [fallback, setFallback] = useState(
    () =>
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      new URLSearchParams(location.search).has("no-webgl"),
  );
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () =>
      setFallback(
        media.matches || new URLSearchParams(location.search).has("no-webgl"),
      );
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (fallback || !host.current) return;
    const element = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      setFallback(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-5.6, 5.6, 2.6, -2.6, 0.1, 100);
    camera.position.set(0, 0, 12);
    const ambient = new THREE.AmbientLight("#cad8ff", 1.6);
    scene.add(ambient);
    const light = new THREE.DirectionalLight("#c5d0ff", 3);
    light.position.set(2, 4, 8);
    scene.add(light);
    const central = new THREE.Group();
    central.position.x = 0.6;
    scene.add(central);
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.46, 0),
      new THREE.MeshStandardMaterial({
        color: "#a6b5ff",
        metalness: 0.55,
        roughness: 0.25,
        emissive: "#394fa6",
        emissiveIntensity: 0.3,
      }),
    );
    central.add(core);
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(0.73, 0.015, 8, 80),
      new THREE.MeshBasicMaterial({
        color: "#7d93e0",
        transparent: true,
        opacity: 0.65,
      }),
    );
    orbit.rotation.x = 0.6;
    orbit.rotation.y = 0.22;
    central.add(orbit);
    const outer = orbit.clone();
    outer.scale.setScalar(1.23);
    outer.rotation.x = -0.75;
    central.add(outer);
    const curves: THREE.CubicBezierCurve3[] = [];
    const pipes: THREE.Mesh[] = [];
    SOURCES.forEach((src, i) => {
      const y = 1.25 - i * 1.25;
      const group = new THREE.Group();
      group.position.set(-3.95, y, 0);
      scene.add(group);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.018, 8, 40),
        new THREE.MeshBasicMaterial({ color: src.color }),
      );
      group.add(ring);
      const node = new THREE.Mesh(
        i === 0
          ? new THREE.OctahedronGeometry(0.17)
          : i === 1
            ? new THREE.SphereGeometry(0.14, 12, 12)
            : new THREE.IcosahedronGeometry(0.17),
        new THREE.MeshStandardMaterial({
          color: src.color,
          emissive: src.color,
          emissiveIntensity: 0.3,
          wireframe: i === 1,
        }),
      );
      group.add(node);
      const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(-3.55, y, 0),
        new THREE.Vector3(-1.9, y, 0),
        new THREE.Vector3(-1.6, 0, 0),
        new THREE.Vector3(-0.2, 0, 0),
      );
      curves.push(curve);
      const pipe = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 60, 0.015, 6, false),
        new THREE.MeshBasicMaterial({
          color: src.color,
          transparent: true,
          opacity: 0.5,
        }),
      );
      pipes.push(pipe);
      scene.add(pipe);
    });
    updateWeights.current = () => {
      pipes.forEach((pipe, i) => {
        pipe.geometry.dispose();
        pipe.geometry = new THREE.TubeGeometry(
          curves[i],
          60,
          0.009 + latest.current.sources[i].weight * 0.055,
          6,
          false,
        );
        (pipe.material as THREE.MeshBasicMaterial).opacity =
          0.2 + latest.current.sources[i].weight * 0.75;
      });
    };
    updateWeights.current();
    const outCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(1.45, 0, 0),
      new THREE.Vector3(2, 0, 0),
      new THREE.Vector3(2.5, 0, 0),
      new THREE.Vector3(3.3, 0, 0),
    );
    curves.push(outCurve);
    scene.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(outCurve, 24, 0.027, 8, false),
        new THREE.MeshBasicMaterial({ color: "#aabaff" }),
      ),
    );
    const output = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.45, 0.45),
      new THREE.MeshStandardMaterial({
        color: "#b4c4ff",
        metalness: 0.6,
        roughness: 0.3,
      }),
    );
    output.position.set(3.65, 0, 0);
    output.rotation.set(0.4, 0.65, 0.15);
    scene.add(output);
    const particles = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.027, 5, 5),
      new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      120,
    );
    scene.add(particles);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 120; i++)
      particles.setColorAt(
        i,
        new THREE.Color(i < 90 ? SOURCES[Math.floor(i / 30)].color : "#bdc9ff"),
      );
    const resize = () => {
      const w = element.clientWidth,
        h = element.clientHeight;
      renderer.setSize(w, h);
      camera.left = -5.6;
      camera.right = 5.6;
      camera.top = (5.6 * h) / w;
      camera.bottom = -camera.top;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let visible = true;
    const intersection = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    });
    intersection.observe(element);
    let frame = 0;
    const start = performance.now();
    let lastTime = start;
    const frameTimes: number[] = [];
    const lose = (event: Event) => {
      event.preventDefault();
      setFallback(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", lose);
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (!visible || document.hidden) {
        lastTime = performance.now();
        return;
      }
      const now = performance.now();
      frameTimes.push(now - lastTime);
      lastTime = now;
      if (frameTimes.length === 120) {
        const sorted = frameTimes.sort((a, b) => a - b);
        element.dataset.medianFps = (1000 / sorted[60]).toFixed(1);
        frameTimes.length = 0;
      }
      const time = (now - start) / 1000;
      core.rotation.y = time * 0.08;
      core.rotation.z = 0.15 + Math.sin(time * 0.2) * 0.06;
      for (let i = 0; i < 120; i++) {
        const source = Math.floor(i / 30);
        const weight = source < 3 ? latest.current.sources[source].weight : 1;
        const active = i % 30 < Math.ceil(weight * 28 + 2);
        const p = curves[source].getPoint(((i % 30) / 30 + time * 0.12) % 1);
        dummy.position.copy(p);
        dummy.scale.setScalar(active && weight > 0 ? 1 + weight * 0.7 : 0);
        dummy.updateMatrix();
        particles.setMatrixAt(i, dummy.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      updateWeights.current = null;
      observer.disconnect();
      intersection.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lose);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const ms = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          ms.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [fallback]);
  if (fallback) return <FlatPipeline forecast={forecast} />;
  return (
    <div
      className="pipeline-scene"
      aria-label="Three source models feed the adaptive blending engine"
    >
      <div className="three-host" ref={host} />
      <div className="pipeline-source-labels">
        {SOURCES.map((s, i) => (
          <div key={s.id}>
            <span style={{ color: s.color }}>{s.short}</span>
            <b>{(forecast.sources[i].weight * 100).toFixed(0)}%</b>
          </div>
        ))}
      </div>
      <div className="pipeline-node-label blend-label">
        Blending engine<span>Skill-weighted fusion</span>
      </div>
      <div className="pipeline-node-label output-label">
        Forecast<span>Decision-ready guidance</span>
      </div>
      <span className="pipeline-caption">
        Flow intensity reflects source influence
      </span>
    </div>
  );
}
