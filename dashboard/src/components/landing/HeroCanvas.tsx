"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.045);
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 0, 18);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    const nodeCount = isMobile ? 90 : 180;
    const nodes: THREE.Vector3[] = [];
    const positions = new Float32Array(nodeCount * 3);
    const nodeColors = new Float32Array(nodeCount * 3);
    for (let i = 0; i < nodeCount; i += 1) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / nodeCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const radius = 7 + Math.random() * 3.5;
      const x = Math.sin(phi) * Math.cos(theta) * radius;
      const y = Math.sin(phi) * Math.sin(theta) * radius * 0.7;
      const z = Math.cos(phi) * radius;
      positions.set([x, y, z], i * 3);
      const brightness = 0.5 + Math.random() * 0.5;
      nodeColors.set([brightness, brightness, brightness], i * 3);
      nodes.push(new THREE.Vector3(x, y, z));
    }

    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    nodeGeometry.setAttribute("color", new THREE.BufferAttribute(nodeColors, 3));
    const nodeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
      },
      vertexShader: `
      attribute vec3 color;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vPulse;
      void main() {
        vColor = color;
        vec3 pos = position;
        // Gentle breathing motion
        float pulse = 1.0 + 0.06 * sin(uTime * 0.6 + position.x * 0.4 + position.y * 0.3);
        pos *= pulse;
        vPulse = pulse;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = (1.8 + 2.2 * color.r) * uPixelRatio * (16.0 / -mvPosition.z);
      }
    `,
      fragmentShader: `
      varying vec3 vColor;
      varying float vPulse;
      void main() {
        vec2 cxy = 2.0 * gl_PointCoord - 1.0;
        float r = dot(cxy, cxy);
        if (r > 1.0) discard;
        float alpha = (1.0 - r) * (0.7 + 0.3 * vPulse);
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const nodePoints = new THREE.Points(nodeGeometry, nodeMaterial);
    scene.add(nodePoints);

    const maxEdges = isMobile ? 2 : 3;
    const maxDistance = 4.2;
    const linePositions: number[] = [];
    const lineAlphas: number[] = [];
    for (let i = 0; i < nodes.length; i += 1) {
      let edges = 0;
      const candidates: { j: number; d: number }[] = [];
      for (let j = i + 1; j < nodes.length; j += 1) {
        const distance = nodes[i].distanceTo(nodes[j]);
        if (distance < maxDistance) candidates.push({ j, d: distance });
      }
      candidates.sort((a, b) => a.d - b.d);
      for (let k = 0; k < Math.min(candidates.length, maxEdges); k += 1) {
        const { j, d } = candidates[k];
        const a = nodes[i];
        const b = nodes[j];
        linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        const alpha = 1 - d / maxDistance;
        lineAlphas.push(alpha, alpha);
        edges += 1;
        if (edges === 1 && Math.random() < 0.15 && candidates.length > 3) {
          const far = nodes[candidates[candidates.length - 1].j];
          linePositions.push(a.x, a.y, a.z, far.x, far.y, far.z);
          lineAlphas.push(0.2, 0.2);
        }
      }
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute("alpha", new THREE.Float32BufferAttribute(lineAlphas, 1));
    const lineMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
      attribute float alpha;
      uniform float uTime;
      varying float vAlpha;
      varying float vDist;
      void main() {
        // Shared breathing with nodes
        vAlpha = alpha;
        vec3 pos = position;
        float pulse = 1.0 + 0.06 * sin(uTime * 0.6 + position.x * 0.4 + position.y * 0.3);
        pos *= pulse;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vDist = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
      fragmentShader: `
      varying float vAlpha;
      varying float vDist;
      void main() {
        // Fade lines that are far from camera
        float fade = clamp(1.0 - (vDist - 8.0) / 24.0, 0.0, 1.0);
        float a = vAlpha * fade * 0.55;
        gl_FragColor = vec4(1.0, 1.0, 1.0, a);
      }
    `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lineSegments);

    const coreGeometry = new THREE.IcosahedronGeometry(0.35, 3);
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);

    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 256;
    const context = glowCanvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
      gradient.addColorStop(0, "rgba(255,255,255,0.9)");
      gradient.addColorStop(0.3, "rgba(255,255,255,0.25)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 256, 256);
    }
    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.scale.setScalar(6);
    scene.add(glowSprite);

    const starCount = isMobile ? 200 : 500;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const radius = 20 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      starPositions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * radius;
      starPositions[i * 3 + 2] = Math.cos(phi) * radius;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.06,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMouseMove = (event: MouseEvent) => {
      mouse.tx = (event.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    let scrollProgress = 0;
    let scrollTarget = 0;
    const updateScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollTarget = max > 0 ? window.scrollY / max : 0;
    };
    window.addEventListener("scroll", updateScroll, { passive: true });
    updateScroll();

    const clock = new THREE.Clock();
    let animationFrame = 0;
    let resizeFrame = 0;
    let paused = document.hidden;
    const onVisibility = () => {
      paused = document.hidden;
      if (!paused) clock.getDelta();
    };
    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate);
      if (paused) return;
      const time = clock.getElapsedTime();
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      scrollProgress += (scrollTarget - scrollProgress) * 0.06;
      nodePoints.rotation.y = time * 0.08;
      nodePoints.rotation.x = Math.sin(time * 0.15) * 0.12;
      lineSegments.rotation.copy(nodePoints.rotation);
      core.rotation.y = -time * 0.3;
      const cameraRadius = 18 - scrollProgress * 6;
      const cameraAngleX = mouse.x * 0.35;
      const cameraAngleY = mouse.y * 0.25;
      camera.position.x = Math.sin(cameraAngleX) * cameraRadius * 0.35;
      camera.position.y = -cameraAngleY * 3 - scrollProgress * 2;
      camera.position.z = cameraRadius;
      camera.lookAt(0, scrollProgress * -1.5, 0);
      nodeMaterial.uniforms.uTime.value = time;
      lineMaterial.uniforms.uTime.value = time;
      stars.rotation.y = time * 0.008;
      const fade = Math.max(0.15, 1 - scrollProgress * 1.5);
      nodeMaterial.opacity = fade;
      lineMaterial.opacity = fade;
      renderer.render(scene, camera);
    };
    const onResize = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        nodeMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
        if (reduceMotion) renderer.render(scene, camera);
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    if (!reduceMotion) animate();
    else renderer.render(scene, camera);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(resizeFrame);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      glowTexture.dispose();
      glowMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} id="hero-canvas" aria-hidden="true" />;
}
