```
/bioelectric-gpu-sim
├── index.html
├── src/
│   ├── main.ts          // WebGPU init & render loop
│   ├── engine.ts        // Buffer management & pipeline setup
│   ├── shaders/
│   │   ├── compute.wgsl // The PDE solver (Diffusion/Reaction)
│   │   └── render.wgsl  // Heatmap visualization
├── package.json
└── vite.config.ts
```
