# Project Architecture: nasa-space-apps

> Generated locally using Graphify and Ollama.
> Updated: 2026-11-15 02:46:22
>
> This document summarizes the architecture to support
> efficient development with Codex.
>
> Always validate this documentation against source code.
> Graphify relationships may be inferred or outdated.

---
## 1. Project Overview

### Project Purpose
The `nasa-space-apps` project is an MVP (Minimum Viable Product) that demonstrates a space-crew health telemetry flow. It simulates a wearable sending readings to the onboard service, which processes and stores the data locally, then synchronizes it with Earth when the link is available.

### Main Functionality
- **Wearable Emulator (TypeScript/Vercel)**: Simulates wearable telemetry data.
- **Onboard API and Processing (FastAPI)**: Stores readings, evaluates alerts, and maintains a reliable outbox.
- **Earth Ingestion and Query API (FastAPI)**: Receives synchronized events idempotently.
- **Crew Hub and Earth View (React/Vite)**: Provides the user interface for viewing crew health data.

### Languages and Frameworks
- **Python**: For backend services.
- **TypeScript**: For the emulator and web frontend.
- **FastAPI**: For building the API endpoints.
- **React/Vite**: For the web frontend.
- **PostgreSQL**: For database storage.
- **Alembic**: For database migrations.

### Runtime and Execution Environment
- **Docker**: For running the entire stack locally.
- **Python**: For backend services.
- **Node.js**: For the emulator and web frontend.

### Relevant Architectural Decisions
- **Microservices Architecture**: The project is divided into three main services: `emu`, `onboard`, and `earth`.
- **FastAPI**: Used for building RESTful APIs.
- **PostgreSQL**: For storing telemetry data.
- **Alembic**: For managing database migrations.
- **Docker Compose**: For orchestrating the development environment.

## 2. Architecture Overview

### Architectural Pattern
The project follows a microservices architecture, with each service running in its own container. The services communicate via HTTP/HTTPS endpoints.

### Application Layers
- **Presentation Layer**: The web frontend (`app/web`) and emulator (`app/emu`).
- **Application Layer**: The onboard service (`app/onboard`) and earth service (`app/earth`).
- **Infrastructure Layer**: Shared utilities and dependencies (`app/common`).

### Main Entry Points
- **Web Frontend**: `app/web`
- **Onboard API**: `app/onboard`
- **Earth API**: `app/earth`
- **Emulator**: `app/emu`

### Dependency Direction
- **Web Frontend**: Depends on Onboard API and Earth API.
- **Onboard API**: Depends on Earth API.
- **Emulator**: Depends on Onboard API.

### Module Organization
- **Common**: Shared code used by all services.
- **Emu**: Wearable emulator.
- **Onboard**: Onboard API and processing.
- **Earth**: Earth ingestion and query API.
- **Web**: Crew Hub and Earth View.

### Relevant Integrations
- **Database**: PostgreSQL for storing telemetry data.
- **APIs**: Onboard API and Earth API for data exchange.
- **Docker Compose**: For orchestrating the development environment.

## 3. Module Responsibilities

| Module or Component | Relevant File Paths | Responsibility | Dependencies | When Codex Should Inspect It |
| --- | --- | --- | --- | --- |
| **Common** | `app/common/src/hub_common/` | Shared code used by all services. | None | Always |
| **Emu** | `app/emu/` | Wearable emulator. | Onboard API | When modifying emulator logic |
| **Onboard** | `app/onboard/` | Onboard API and processing. | Earth API | When modifying onboard logic |
| **Earth** | `app/earth/` | Earth ingestion and query API. | None | When modifying earth logic |
| **Web** | `app/web/` | Crew Hub and Earth View. | Onboard API, Earth API | When modifying web frontend logic |

## 4. Execution and Data Flows

### Entry Points
- **Web Frontend**: `app/web`
- **Onboard API**: `app/onboard`
- **Earth API**: `app/earth`
- **Emulator**: `app/emu`

### Function or Component Interactions
- **Web Frontend**: Calls Onboard API and Earth API to fetch data.
- **Onboard API**: Calls Earth API to synchronize data.
- **Emulator**: Sends telemetry data to Onboard API.

### State and Data Movement
- **Web Frontend**: Fetches data from Onboard API and Earth API.
- **Onboard API**: Stores data in PostgreSQL and calls Earth API.
- **Earth API**: Receives data and stores it idempotently.

### Backend or API Interactions When Present
- **Web Frontend**: Interacts with Onboard API and Earth API.
- **Onboard API**: Interacts with Earth API.

### Dependency Chains
- **Web Frontend**: Onboard API -> Earth API
- **Onboard API**: Earth API
- **Emulator**: Onboard API

## 5. Code Organization

### Directory Structure
```
app/
├── emu/          # Wearable emulator (TypeScript/Vercel)
├── onboard/      # Onboard API and processing (FastAPI)
├── earth/        # Earth ingestion and query API (FastAPI)
├── web/          # Crew Hub and Earth View (React/Vite)
├── common/       # Shared Python code
├── contracts/    # Metric catalog and crew data
├── pyproject.toml
└── uv.lock
docs/             # Architecture, plan, and product documentation
infra/
└── docker-compose.yml
scripts/
└── start.py      # Local launcher
```

### File Naming Conventions
- **Python**: snake_case for functions, variables, and classes.
- **TypeScript**: camelCase for functions, variables, and classes.
- **JSON**: camelCase for keys.

### Module Boundaries
- **Common**: Shared code used by all services.
- **Emu**: Wearable emulator.
- **Onboard**: Onboard API and processing.
- **Earth**: Earth ingestion and query API.
- **Web**: Crew Hub and Earth View.

### Shared Components
- **Database**: PostgreSQL for storing telemetry data.
- **APIs**: Onboard API and Earth API for data exchange.

### Reusable Services and Utilities
- **FastAPI**: For building RESTful APIs.
- **Alembic**: For managing database migrations.

### Configuration Organization
- **Environment Variables**: `.env` file for configuration.
- **Docker Compose**: `docker-compose.yml` for orchestrating the development environment.

## 6. Coding Conventions

### Naming
- **Python**: snake_case for functions, variables, and classes.
- **TypeScript**: camelCase for functions, variables, and classes.
- **JSON**: camelCase for keys.

### Functions and Methods
- **Python**: Use type hints for function parameters and return types.
- **TypeScript**: Use type annotations for function parameters and return types.

### Classes and Interfaces
- **Python**: Use `class` keyword for defining classes.
- **TypeScript**: Use `interface` keyword for defining interfaces.

### Types
- **Python**: Use `typing` module for type hints.
- **TypeScript**: Use TypeScript's built-in types.

### Error Handling
- **Python**: Use `try-except` blocks for error handling.
- **TypeScript**: Use `try-catch` blocks for error handling.

### Imports and Exports
- **Python**: Use `import` statement for importing modules.
- **TypeScript**: Use `import` statement for importing modules.

### Component Structure
- **Python**: Use classes and functions to organize code.
- **TypeScript**: Use classes and functions to organize code.

### State Management
- **Python**: Use `asyncio` for managing state.
- **TypeScript**: Use `async/await` for managing state.

### Styling
- **Python**: Use PEP 8 for code styling.
- **TypeScript**: Use Prettier for code styling.

### Dependency Injection
- **Python**: Use `fastapi` for dependency injection.
- **TypeScript**: Use `fastapi` for dependency injection.

## 7. Dependencies and Integrations

### Important Libraries
- **Python**: `fastapi`, `sqlalchemy`, `alembic`, `uvicorn`.
- **TypeScript**: `fastapi`, `react`, `vite`, `typescript`.

### Internal Dependencies
- **Common**: Shared code used by all services.
- **Emu**: Wearable emulator.
- **Onboard**: Onboard API and processing.
- **Earth**: Earth ingestion and query API.
- **Web**: Crew Hub and Earth View.

### External Services
- **Database**: PostgreSQL for storing telemetry data.
- **APIs**: Onboard API and Earth API for data exchange.

### Shared Modules
- **FastAPI**: For building RESTful APIs.
- **Alembic**: For managing database migrations.

### Configuration Dependencies
- **Environment Variables**: `.env` file for configuration.
- **Docker Compose**: `docker-compose.yml` for orchestrating the development environment.

### Components with Broad Impact
- **Web Frontend**: Interacts with Onboard API and Earth API.
- **Onboard API**: Interacts with Earth API.

## 8. Development Commands

### Verified Commands
- **Python**:
  - `python scripts/start.py`: Start the complete stack.
  - `python -m unittest discover -s app/contracts/tests`: Run tests for contracts.
- **TypeScript**:
  - `cd app/emu && npm run typecheck`: Typecheck the emulator code.
  - `cd app/web && npm run typecheck && npm test`: Typecheck and test the web frontend code.

## 9. Change Impact Guide

### Adding a Feature
1. Identify the relevant module.
2. Read the architecture instructions.
3. Consult the graph report only when needed.
4. Inspect source files before modifying code.
5. Follow existing project conventions.
6. Reuse established abstractions.
7. Minimize unrelated changes.
8. Run verified validation commands.

### Updating an Existing Feature
1. Identify the relevant module.
2. Read the architecture instructions.
3. Consult the graph report only when needed.
4. Inspect source files before modifying code.
5. Follow existing project conventions.
6. Reuse established abstractions.
7. Minimize unrelated changes.
8. Run verified validation commands.

### Refactoring Shared Code
1. Identify the relevant module.
2. Read the architecture instructions.
3. Consult the graph report only when needed.
4. Inspect source files before modifying code.
5. Follow existing project conventions.
6. Reuse established abstractions.
7. Minimize unrelated changes.
8. Run verified validation commands.

### Changing Application Configuration
1. Identify the relevant module.
2. Read the architecture instructions.
3. Consult the graph report only when needed.
4. Inspect source files before modifying code.
5. Follow existing project conventions.
6. Reuse established abstractions.
7. Minimize unrelated changes.
8. Run verified validation commands.

### Adding Dependencies
1. Identify the relevant module.
2. Read the architecture instructions.
3. Consult the graph report only when needed.
4. Inspect source files before modifying code.
5. Follow existing project conventions.
6. Reuse established abstractions.
7. Minimize unrelated changes.
8. Run verified validation commands.

### Modifying Integration Behavior
1. Identify the relevant module.
2. Read the architecture instructions.
3. Consult the graph report only when needed.
4. Inspect source files before modifying code.
5. Follow existing project conventions.
6. Reuse established abstractions.
7. Minimize unrelated changes.
8. Run verified validation commands.

### Updating Tests
1. Identify the relevant module.
2. Read the architecture instructions.
3. Consult the graph report only when needed.
4. Inspect source files before modifying code.
5. Follow existing project conventions.
6. Reuse established abstractions.
7. Minimize unrelated changes.
8. Run verified validation commands.

## 10. Architecture Risks

### Coupled Modules
- **Web Frontend**: Interacts with Onboard API and Earth API.
- **Onboard API**: Interacts with Earth API.

### Important Dependency Relationships
- **Database**: PostgreSQL for storing telemetry data.
- **APIs**: Onboard API and Earth API for data exchange.

### Shared State
- **Database**: Shared state for storing telemetry data.

### Critical Execution Paths
- **Web Frontend**: Fetches data from Onboard API and Earth API.
- **Onboard API**: Stores data in PostgreSQL and calls Earth API.
- **Earth API**: Receives data and stores it idempotently.

### Areas that Require Extra Verification
- **Web Frontend**: Interacts with Onboard API and Earth API.
- **Onboard API**: Interacts with Earth API.

### Unknown or Uncertain Relationships
- **Database**: Shared state for storing telemetry data.

## 11. Codex Development Workflow

1. Identify relevant modules.
2. Read the architecture instructions.
3. Consult the graph report only when needed.
4. Inspect source files before modifying code.
5. Follow existing project conventions.
6. Reuse established abstractions.
7. Minimize unrelated changes.
8. Run verified validation commands.

## 12. Quick Reference

| Common Development Tasks | Files/Modules Involved |
| --- | --- |
| Adding a Feature | Relevant module, architecture instructions, graph report, source files |
| Updating an Existing Feature | Relevant module, architecture instructions, graph report, source files |
| Refactoring Shared Code | Relevant module, architecture instructions, graph report, source files |
| Changing Application Configuration | Relevant module, architecture instructions, graph report, source files |
| Adding Dependencies | Relevant module, architecture instructions, graph report, source files |
| Modifying Integration Behavior | Relevant module, architecture instructions, graph report, source files |
| Updating Tests | Relevant module, architecture instructions, graph report, source files |

This document provides a detailed and efficient project instructions for OpenAI Codex using the repository context. It covers project overview, architecture, module responsibilities, execution and data flows, code organization, coding conventions, dependencies and integrations, development commands, change impact guide, architecture risks, and a development workflow.
