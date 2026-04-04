const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const swaggerUi = require('swagger-ui-express');

const app = express();

// ── Microservices Registry ────────────────────────────────────────
const SERVICES = {
  users:       'http://localhost:3001',
  restaurants: 'http://localhost:3002',
  orders:      'http://localhost:3003',
  deliveries:  'http://localhost:3004',
};

// ── Gateway Root Route ───────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: ' Food Delivery API Gateway',
    version: '1.0.0',
    availableServices: Object.keys(SERVICES).map((name) => ({
      service: name,
      gatewayPath: `/api/${name}`,
      swaggerViaGateway: `/api/${name}/api-docs`,
      directSwagger: `${SERVICES[name]}/api-docs`,
    })),
  });
});

// ── Proxy Middleware ──────────────────────────────────────────────
Object.entries(SERVICES).forEach(([name, target]) => {
  app.use(
    `/api/${name}`,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: (path) => {
        // Forward Swagger requests directly to /api-docs in the service
        if (path.includes('/api-docs')) {
          return path.replace(`/api/${name}`, '');
        }
        // Forward all other requests to the correct service route
        return path.replace(`/api/${name}`, `/${name}`);
      },
      onError: (err, req, res) => {
        res.status(502).json({ error: `${name} service unavailable`, detail: err.message });
      },
    })
  );
  console.log(`✔ Proxy: /api/${name} → ${target}`);
});

// ── Aggregated Gateway Swagger ───────────────────────────────────
const gatewaySwaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Food Delivery API Gateway',
    version: '1.0.0',
    description: `
# API Gateway – Single Entry Point

Central gateway that routes requests to all microservices.
    `,
  },
  servers: [{ url: 'http://localhost:3000' }],
  paths: {},
};

// Function to fetch and merge Swagger specs from each service
const mergeSwaggerSpecs = async () => {
  for (const [name, target] of Object.entries(SERVICES)) {
    try {
      const response = await fetch(`${target}/swagger.json`);
      if (!response.ok) {
        console.warn(`⚠ Could not fetch Swagger spec from ${name} service (Status: ${response.status})`);
        continue;
      }
      const serviceSpec = await response.json();
      
      // Merge paths from the service into the gateway spec
      if (serviceSpec.paths) {
        Object.entries(serviceSpec.paths).forEach(([path, pathItem]) => {
          // Prefix the path with /api/{serviceName}
          const gatewayPath = `/api/${name}${path === '/' ? '' : path}`;
          
          // Add tags to each method for better organization
          const serviceName = name.charAt(0).toUpperCase() + name.slice(1);
          Object.keys(pathItem).forEach((method) => {
            if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
              if (!pathItem[method].tags) {
                pathItem[method].tags = [];
              }
              if (!pathItem[method].tags.includes(serviceName)) {
                pathItem[method].tags.push(serviceName);
              }
            }
          });
          
          // Merge into gateway spec
          gatewaySwaggerSpec.paths[gatewayPath] = {
            ...gatewaySwaggerSpec.paths[gatewayPath],
            ...pathItem,
          };
        });
        console.log(`✔ Merged Swagger spec from ${name} service`);
      }
    } catch (err) {
      console.warn(`⚠ Error fetching Swagger spec from ${name}: ${err.message}`);
    }
  }
};

// Merge specs and setup Swagger UI
const setupSwagger = async () => {
  // Wait for services to fully boot
  await new Promise(resolve => setTimeout(resolve, 3000));
  await mergeSwaggerSpecs();
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(gatewaySwaggerSpec));
  console.log(`✔ Swagger UI setup complete`);
  
  // Register 404 fallback after swagger routes
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found in API Gateway' });
  });

  // Start Gateway after setup is complete
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`\n API Gateway running on http://localhost:${PORT}`);
    console.log(` Gateway Swagger: http://localhost:${PORT}/api-docs\n`);
  });
};

setupSwagger();

// Remove the old 404 and listen that were here