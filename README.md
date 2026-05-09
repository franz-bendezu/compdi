# compdi-monorepo

Monorepo de Compdi basado en Turborepo.

## Estructura

```text
compdi-monorepo/
├── packages/
│   ├── core/          # @compdi/core (macros tipadas)
│   ├── unplugin/      # unplugin-compdi (transformador)
│   └── shared/        # utilidades internas
├── playground/        # app Vite para validar transformaciones
├── turbo.json
└── package.json
```

## Paquetes

- `@compdi/core`: firmas TypeScript para macros de DI.
- `@compdi/shared`: utilidades comunes para parsing/rewrite.
- `unplugin-compdi`: plugin de compilación para reescribir macros.

## Scripts

- `npm run build`: build de todos los paquetes.
- `npm run dev`: modo desarrollo en paralelo.
- `npm run typecheck`: validación de tipos.
- `npm run lint`: lint (placeholder por paquete).

## Arranque rápido

1. `npm install`
2. `npm run build`
3. `npm run dev`