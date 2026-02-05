import computeShaderSource from './shaders/compute.wgsl?raw';
import renderShaderSource from './shaders/render.wgsl?raw';

async function run() {
  const canvas = document.querySelector('canvas')!;
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter!.requestDevice();
  const context = canvas.getContext('webgpu')!;
  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({ device, format });

  const GRID_SIZE = 512;
  const BUFFER_SIZE = GRID_SIZE * GRID_SIZE * 4; // f32 is 4 bytes

  // 1. Create Buffers
  const bufferA = device.createBuffer({
    size: BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const bufferB = device.createBuffer({
    size: BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  
  // Uniform buffer for UI parameters (diffusion, dt, etc)
  const paramsBuffer = device.createBuffer({
    size: 32, 
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // 2. Load Shaders & Pipelines
  const computeModule = device.createShaderModule({ code: computeShaderSource });
  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: computeModule, entryPoint: 'main' },
  });

  const renderModule = device.createShaderModule({ code: renderShaderSource });
  const renderPipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: renderModule, entryPoint: 'vs_main' },
    fragment: { module: renderModule, entryPoint: 'fs_main', targets: [{ format }] },
    primitive: { topology: 'triangle-strip' },
  });

  // 3. Bind Groups (Ping-Pong)
  const createBindGroup = (inBuffer: GPUBuffer, outBuffer: GPUBuffer) => 
    device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inBuffer } },
        { binding: 1, resource: { buffer: outBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } },
      ],
    });

  const bindGroup1 = createBindGroup(bufferA, bufferB);
  const bindGroup2 = createBindGroup(bufferB, bufferA);

  let step = 0;

  function frame() {
    const commandEncoder = device.createCommandEncoder();
    
    // --- COMPUTE PASS ---
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, step % 2 === 0 ? bindGroup1 : bindGroup2);
    computePass.dispatchWorkgroups(GRID_SIZE / 8, GRID_SIZE / 8);
    computePass.end();

    // --- RENDER PASS ---
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    renderPass.setPipeline(renderPipeline);
    // Bind the *output* of the compute pass to the renderer
    renderPass.setBindGroup(0, step % 2 === 0 ? bindGroup1 : bindGroup2); 
    renderPass.draw(4); // Drawing a full-screen quad
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
    
    step++;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

run();
