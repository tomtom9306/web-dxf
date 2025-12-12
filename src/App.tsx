import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import DxfParser from 'dxf-parser';

interface EntitySummary {
  type: string;
  count: number;
}

interface DxfMeta {
  name: string;
  version?: string;
  createdAt?: string;
  totalEntities: number;
  summaries: EntitySummary[];
}

const arcSegmentCount = 32;

const formatter = new Intl.NumberFormat();

function buildGeometry(entity: any): THREE.Line | null {
  switch (entity.type) {
    case 'LINE': {
      const points = [
        new THREE.Vector3(entity.start.x, entity.start.y, entity.start.z || 0),
        new THREE.Vector3(entity.end.x, entity.end.y, entity.end.z || 0),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x7dd3fc }));
    }
    case 'LWPOLYLINE': {
      const points = (entity.vertices || []).map(
        (vertex: any) => new THREE.Vector3(vertex.x, vertex.y, vertex.z || 0),
      );
      if (entity.shape || entity.closed) {
        const first = points[0];
        if (first) points.push(first.clone());
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x818cf8 }));
    }
    case 'POLYLINE': {
      const points = (entity.vertices || []).map(
        (vertex: any) => new THREE.Vector3(vertex.x, vertex.y, vertex.z || 0),
      );
      if (entity.shape || entity.closed) {
        const first = points[0];
        if (first) points.push(first.clone());
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x22d3ee }));
    }
    case 'CIRCLE': {
      const segments = 64;
      const geometry = new THREE.CircleGeometry(entity.radius, segments);
      geometry.translate(entity.center.x, entity.center.y, entity.center.z || 0);
      const edges = new THREE.EdgesGeometry(geometry);
      return new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xfbbf24 }));
    }
    case 'ARC': {
      const start = THREE.MathUtils.degToRad(entity.startAngle);
      const end = THREE.MathUtils.degToRad(entity.endAngle);
      const points: THREE.Vector3[] = [];
      const delta = (end - start) / arcSegmentCount;
      for (let i = 0; i <= arcSegmentCount; i += 1) {
        const angle = start + delta * i;
        points.push(
          new THREE.Vector3(
            entity.center.x + entity.radius * Math.cos(angle),
            entity.center.y + entity.radius * Math.sin(angle),
            entity.center.z || 0,
          ),
        );
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xf472b6 }));
    }
    default:
      return null;
  }
}

function summarizeEntities(entities: any[]): EntitySummary[] {
  const map = new Map<string, number>();
  entities.forEach((entity) => {
    const type = entity.type || 'UNKNOWN';
    map.set(type, (map.get(type) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

function formatExtents(box: THREE.Box3 | null): string {
  if (!box) return 'Not available';
  const size = new THREE.Vector3();
  box.getSize(size);
  return `${size.x.toFixed(2)} x ${size.y.toFixed(2)} (model units)`;
}

function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const [meta, setMeta] = useState<DxfMeta | null>(null);
  const [status, setStatus] = useState<string>('Drop a DXF file or choose one to start.');
  const [boundingBox, setBoundingBox] = useState<THREE.Box3 | null>(null);
  const [entityCount, setEntityCount] = useState(0);

  const parser = useMemo(() => new DxfParser(), []);

  useEffect(() => {
    if (!mountRef.current) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x0b1224, 1);
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera();
    camera.position.set(0, 0, 1000);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const axesHelper = new THREE.AxesHelper(50);
    scene.add(axesHelper);

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const { clientWidth, clientHeight } = mountRef.current;
      rendererRef.current.setSize(clientWidth, clientHeight);
      const aspect = clientWidth / clientHeight;
      const viewSize = cameraRef.current.top - cameraRef.current.bottom || 200;
      const halfHeight = viewSize / 2;
      cameraRef.current.left = -halfHeight * aspect;
      cameraRef.current.right = halfHeight * aspect;
      cameraRef.current.updateProjectionMatrix();
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let animationId = 0;
    const renderLoop = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      animationId = requestAnimationFrame(renderLoop);
    };

    animationId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      scene.clear();
    };
  }, []);

  const focusCameraOnBox = (box: THREE.Box3) => {
    if (!cameraRef.current || !mountRef.current) return;
    const { clientWidth, clientHeight } = mountRef.current;
    const aspect = clientWidth / clientHeight;
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const viewHeight = Math.max(size.y * 1.2, size.x * 1.2 / aspect, 100);
    const halfHeight = viewHeight / 2;

    cameraRef.current.left = -halfHeight * aspect;
    cameraRef.current.right = halfHeight * aspect;
    cameraRef.current.top = halfHeight;
    cameraRef.current.bottom = -halfHeight;
    cameraRef.current.position.set(center.x, center.y, 1000);
    cameraRef.current.lookAt(center);
    cameraRef.current.updateProjectionMatrix();
  };

  const clearScene = () => {
    if (!sceneRef.current) return;
    sceneRef.current.children = sceneRef.current.children.filter(
      (child) => child.type === 'AmbientLight' || child.type === 'AxesHelper',
    );
  };

  const handleDxf = (file: File) => {
    setStatus(`Loading ${file.name}...`);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const text = new TextDecoder().decode(buffer);
        const dxf = parser.parseSync(text);
        const entities = dxf.entities || [];
        const summaries = summarizeEntities(entities);
        const version = dxf.header?.$ACADVER;
        const createdAt = dxf.header?.$TDCREATE;

        setMeta({
          name: file.name,
          version: version ? String(version) : undefined,
          createdAt: createdAt ? String(createdAt) : undefined,
          totalEntities: entities.length,
          summaries,
        });
        setEntityCount(entities.length);
        setStatus('DXF loaded successfully');

        if (!sceneRef.current) return;
        clearScene();

        const group = new THREE.Group();
        const bbox = new THREE.Box3();

        entities.forEach((entity: any) => {
          const object = buildGeometry(entity);
          if (object) {
            group.add(object);
            bbox.expandByObject(object);
          }
        });

        if (group.children.length === 0) {
          setStatus('No drawable entities found in this DXF.');
          return;
        }

        sceneRef.current.add(group);
        setBoundingBox(bbox);
        focusCameraOnBox(bbox);
      } catch (error) {
        console.error(error);
        setStatus('Unable to parse DXF. Ensure the file is valid.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = event.target.files || [];
    if (file) handleDxf(file);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const [file] = Array.from(event.dataTransfer.files);
    if (file) handleDxf(file);
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div className="app-shell">
      <header>
        <div className="branding">
          <span>DXF</span>
          <div>
            <h1>Universal DXF Viewer</h1>
            <small>Fast, browser-based explorer for any DXF flavor.</small>
          </div>
        </div>
        <div className="controls">
          <label className="label-button">
            <input type="file" accept=".dxf" onChange={onFileChange} />
            <span role="img" aria-label="upload">
              ⬆️
            </span>
            Choose DXF
          </label>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              if (!sceneRef.current) return;
              focusCameraOnBox(boundingBox || new THREE.Box3(new THREE.Vector3(-100, -100, 0), new THREE.Vector3(100, 100, 0)));
            }}
          >
            Recenter view
          </button>
        </div>
      </header>

      <main>
        <aside className="sidebar">
          <section className="panel">
            <h2>File details</h2>
            {meta ? (
              <div className="status">
                <span className="badge">
                  <strong>{meta.name}</strong>
                </span>
                <span>
                  Version: <strong>{meta.version ?? 'Unknown'}</strong>
                </span>
                <span>
                  Entities: <strong>{formatter.format(meta.totalEntities)}</strong>
                </span>
                <span>
                  Extents: <strong>{formatExtents(boundingBox)}</strong>
                </span>
              </div>
            ) : (
              <p>{status}</p>
            )}
          </section>

          <section className="panel">
            <h2>Entity breakdown</h2>
            {meta ? (
              <div className="entity-list">
                {meta.summaries.map((summary) => (
                  <div key={summary.type} className="entity-item">
                    <span className="entity-type">{summary.type}</span>
                    <span className="entity-meta">{formatter.format(summary.count)}</span>
                  </div>
                ))}
                {meta.summaries.length === 0 && <p>No drawable entities found.</p>}
              </div>
            ) : (
              <p>Load a DXF to inspect entities.</p>
            )}
          </section>

          <section className="panel">
            <h2>Usage</h2>
            <ul>
              <li>Supports ASCII and binary DXF variants.</li>
              <li>Drag & drop or use the chooser to open files.</li>
              <li>Common entities (lines, polylines, circles, arcs) render automatically.</li>
            </ul>
          </section>
        </aside>

        <section
          className="viewer-wrapper"
          ref={mountRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          aria-label="DXF preview canvas"
        >
          {entityCount === 0 && <p style={{ padding: 20 }}>{status}</p>}
        </section>
      </main>
    </div>
  );
}

export default App;
