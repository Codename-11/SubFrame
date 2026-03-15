# Contributing to SubFrame

Thanks for your interest in contributing! SubFrame is an open-source terminal IDE for AI coding tools.

## Getting Started

```bash
git clone https://github.com/Codename-11/SubFrame.git
cd SubFrame
npm install
npm run dev
```

## Development

- **Build**: `npm run build`
- **Dev mode**: `npm run dev` (watch + Electron)
- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint`
- **Test**: `npm test`
- **All checks**: `npm run check` (mirrors CI)

## Project Structure

- `src/main/` — Electron main process (Node.js, TypeScript)
- `src/renderer/` — React frontend (React 19, TypeScript, Tailwind CSS v4)
- `src/shared/` — Shared types and IPC channel definitions
- `docs/` — VitePress documentation site

## How to Contribute

1. **Bug reports**: Open an issue with steps to reproduce
2. **Feature requests**: Open an issue describing the use case
3. **Code**: Fork, create a branch (`feature/your-feature`), submit a PR
4. **Testing**: Try SubFrame on macOS/Linux and report issues
5. **Documentation**: Improve docs, fix typos, add examples

## Conventions

- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) — `feat`, `fix`, `docs`, `refactor`, `chore`
- **Branches**: `feature/<name>`, `fix/<name>`, `docs/<name>`
- **TypeScript**: Strict mode enabled
- **Style**: ESLint + Prettier (run `npm run lint` before submitting)

## Code of Conduct

Be respectful and constructive. We're building tools, not fighting wars.
