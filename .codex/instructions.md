# Project Architecture: nasa-space-apps

> Generated locally using Graphify and Ollama.
> Updated: 2026-11-15 08:51:16
>
> This document summarizes the architecture to support
> efficient development with Codex.
>
> Always validate this documentation against source code.
> Graphify relationships may be inferred or outdated.

---
## 1. Project Overview

The `nasa-space-apps` project is a minimalistic simulation of a space-crew health telemetry system. It consists of three main components: a wearable emulator (`emu`), an onboard service (`onboard`), and an Earth ingestion service (`earth`). The web application (`web`) provides a user interface for interacting with the system.

### Project Purpose
The project aims to demonstrate a basic telemetry flow where a simulated wearable sends health data to the onboard service, which processes and stores the data locally. When the link to Earth is available, the onboard service synchronizes the data with Earth.

### Main Functionality
- **Wearable Emulator (`emu`)**: Simulates a wearable device sending telemetry data.
- **Onboard Service (`onboard`)**: Receives data from the emulator, processes it, and stores it locally. It also maintains a reliable outbox for synchronization with Earth.
- **Earth Ingest Service (`earth`)**: Receives synchronized events idempotently.
- **Web Application (`web`)**: Provides a user interface for viewing crew health data and managing the system.

### Languages and Frameworks
- **Python**: Used for the backend services (`onboard` and `earth`).
- **FastAPI**: A modern, fast (high-performance) web framework for building APIs with Python 3.7+ based on standard Python type hints.
- **TypeScript**: Used for the emulator (`emu`) and web application (`web`).
- **React/Vite**: For building the web application's user interface.

### Runtime and Execution Environment
- **Docker**: Used for running the entire stack locally.
- **PostgreSQL**: The database used for storing telemetry data.

### Relevant Architectural Decisions
- **Microservices Architecture**: The project is divided into three microservices (`emu`, `onboard`, `earth`, and `web`), each with its own responsibilities.
- **FastAPI**: Used for building RESTful APIs, which simplifies the development and maintenance of the backend services.
- **Docker Compose**: Used for orchestrating the development environment, making it easy to start and stop all services with a single command.

## 2. Architecture Overview

### Architectural Pattern
The project follows a microservices architecture, where each service is a separate application with its own codebase and dependencies.

### Application Layers
- **Presentation Layer**: The web application (`web`) provides the user interface.
- **Application Layer**: The onboard and Earth services (`onboard` and `earth`) handle the business logic.
- **Infrastructure Layer**: Shared code and utilities (`common`), such as database connections, authentication, and logging.

### Main Entry Points
- **Web Application**: Accessible via `http://localhost:8080`.
- **Onboard API**: Accessible via `http://localhost:8001/docs`.
- **Earth API**: Accessible via `http://localhost:8002/docs`.

### Dependency Direction
- **Web Application**: Depends on the onboard and Earth APIs.
- **Onboard Service**: Depends on the Earth service for synchronization.
- **Earth Service**: Depends on the onboard service for receiving events.

### Module Organization
- **`app/emu`**: Contains the emulator code.
- **`app/onboard`**: Contains the onboard service code.
- **`app/earth`**: Contains the Earth ingestion service code.
- **`app/web`**: Contains the web application code.
- **`app/common`**: Contains shared code and utilities.

### Relevant Integrations
- **FastAPI**: Used for building RESTful APIs.
- **PostgreSQL**: Used for storing telemetry data.
- **Docker Compose**: Used for orchestrating the development environment.

## 3. Module Responsibilities

| Module or Component | Relevant File Paths | Responsibility | Dependencies | When Codex Should Inspect It |
| --- | --- | --- | --- | --- |
| **Emulator (`emu`)** | `app/emu/` | Simulates a wearable device sending telemetry data. | None | Always |
| **Onboard Service (`onboard`)** | `app/onboard/` | Receives data from the emulator, processes it, and stores it locally. Maintains a reliable outbox for synchronization with Earth. | `app/earth/` | When modifying synchronization logic |
| **Earth Ingest Service (`earth`)** | `app/earth/` | Receives synchronized events idempotently. | None | When modifying event handling logic |
| **Web Application (`web`)** | `app/web/` | Provides a user interface for viewing crew health data and managing the system. | `app/onboard/`, `app/earth/` | When modifying UI components or integrating with backend services |
| **Shared Code (`common`)** | `app/common/` | Contains shared code and utilities, such as database connections, authentication, and logging. | None | When modifying shared code or utilities |

## 4. Execution and Data Flows

### Entry Points
- **Web Application**: Accessible via `http://localhost:8080`.
- **Onboard API**: Accessible via `http://localhost:8001/docs`.
- **Earth API**: Accessible via `http://localhost:8002/docs`.

### Function or Component Interactions
- **Web Application**: Calls the onboard and Earth APIs to fetch and display crew health data.
- **Onboard Service**: Receives telemetry data from the emulator, processes it, and stores it locally. It also maintains a reliable outbox for synchronization with Earth.
- **Earth Service**: Receives synchronized events idempotently.

### State and Data Movement
- **Web Application**: Fetches data from the onboard and Earth APIs and displays it to the user.
- **Onboard Service**: Stores telemetry data locally and maintains a reliable outbox for synchronization with Earth.
- **Earth Service**: Receives synchronized events idempotently.

### Backend or API Interactions When Present
- **Web Application**: Interacts with the onboard and Earth APIs to fetch and display crew health data.
- **Onboard Service**: Interacts with the Earth service for synchronization.

### Dependency Chains
- **Web Application**: Depends on the onboard and Earth APIs.
- **Onboard Service**: Depends on the Earth service for synchronization.
- **Earth Service**: Depends on the onboard service for receiving events.

## 5. Code Organization

### Directory Structure
- `app/`: Contains the main application code.
  - `emu/`: Contains the emulator code.
  - `onboard/`: Contains the onboard service code.
  - `earth/`: Contains the Earth ingestion service code.
  - `web/`: Contains the web application code.
  - `common/`: Contains shared code and utilities.
- `docs/`: Contains architecture, plan, and product documentation.
- `infra/`: Contains infrastructure configuration files.
- `scripts/`: Contains scripts for starting the application.

### File Naming Conventions
- Python files use snake_case for function and variable names.
- TypeScript files use camelCase for function and variable names.
- File names use kebab-case for readability.

### Module Boundaries
- Each service (`emu`, `onboard`, `earth`, and `web`) has its own directory and set of dependencies.
- Shared code and utilities are located in the `common` directory.

### Shared Components
- Shared components, such as database connections, authentication, and logging, are located in the `common` directory.

### Reusable Services and Utilities
- Reusable services and utilities, such as database connections, authentication, and logging, are located in the `common` directory.

### Configuration Organization
- Configuration files are located in the `app` directory for each service and in the `infra` directory for infrastructure configuration.

## 6. Coding Conventions

### Naming
- Python files use snake_case for function and variable names.
- TypeScript files use camelCase for function and variable names.
- File names use kebab-case for readability.

### Functions and Methods
- Functions and methods use snake_case for Python and camelCase for TypeScript.
- Functions and methods should have descriptive names that clearly indicate their purpose.

### Classes and Interfaces
- Classes and interfaces use PascalCase for Python and PascalCase for TypeScript.
- Classes and interfaces should have descriptive names that clearly indicate their purpose.

### Types
- Python uses type hints for type annotations.
- TypeScript uses type annotations for type definitions.

### Error Handling
- Python uses `try-except` blocks for error handling.
- TypeScript uses `try-catch` blocks for error handling.

### Imports and Exports
- Python uses `import` statements to import modules and functions.
- TypeScript uses `import` statements to import modules and functions.

### Component Structure
- Components are organized into modules and directories based on their functionality.
- Components should be modular and reusable.

### State Management
- State management is handled by the web application using React's state management hooks.

### Styling
- Styling is handled by the web application using CSS-in-JS or CSS modules.

### Dependency Injection
- Dependency injection is handled by FastAPI's dependency injection system.

## 7. Dependencies and Integrations

### Important Libraries
- **Python**: FastAPI, SQLAlchemy, Pydantic, Uvicorn, Alembic.
- **TypeScript**: React, Vite, TypeScript, Node.js, Axios.

### Internal Dependencies
- **Onboard Service**: Depends on the Earth service for synchronization.
- **Earth Service**: Depends on the onboard service for receiving events.

### External Services
- **PostgreSQL**: Used for storing telemetry data.
- **Web Application**: Depends on the onboard and Earth APIs.

### Shared Modules
- **Shared Code**: Contains shared code and utilities, such as database connections, authentication, and logging.

### Configuration Dependencies
- **Configuration Files**: Contains configuration files for each service and infrastructure.

### Components with Broad Impact
- **Web Application**: Provides the user interface and integrates with backend services.
- **Onboard Service**: Receives data from the emulator, processes it, and stores it locally. Maintains a reliable outbox for synchronization with Earth.
- **Earth Service**: Receives synchronized events idempotently.

## 8. Development Commands

### Verified Commands
- **Development**:
  ```bash
  python scripts/start.py
  ```
- **Build**:
  ```bash
  python -m uvicorn app.onboard:app --reload
  ```
- **Tests**:
  ```bash
  pytest
  ```
- **Linting**:
  ```bash
  ruff .
  ```
- **Formatting**:
  ```bash
  black .
  ```
- **Application Execution**:
  ```bash
  python scripts/start.py --onboard-only
  ```

## 9. Change Impact Guide

### Adding a Feature
- Identify the relevant module or component.
- Read the architecture instructions.
- Consult the graph report only when needed.
- Inspect source files before modifying code.
- Follow existing project conventions.
- Reuse established abstractions.
- Minimize unrelated changes.
- Run verified validation commands.

### Updating an Existing Feature
- Identify the relevant module or component.
- Read the architecture instructions.
- Consult the graph report only when needed.
- Inspect source files before modifying code.
- Follow existing project conventions.
- Reuse established abstractions.
- Minimize unrelated changes.
- Run verified validation commands.

### Refactoring Shared Code
- Identify the relevant module or component.
- Read the architecture instructions.
- Consult the graph report only when needed.
- Inspect source files before modifying code.
- Follow existing project conventions.
- Reuse established abstractions.
- Minimize unrelated changes.
- Run verified validation commands.

### Changing Application Configuration
- Identify the relevant module or component.
- Read the architecture instructions.
- Consult the graph report only when needed.
- Inspect source files before modifying code.
- Follow existing project conventions.
- Reuse established abstractions.
- Minimize unrelated changes.
- Run verified validation commands.

### Adding Dependencies
- Identify the relevant module or component.
- Read the architecture instructions.
- Consult the graph report only when needed.
- Inspect source files before modifying code.
- Follow existing project conventions.
- Reuse established abstractions.
- Minimize unrelated changes.
- Run verified validation commands.

### Modifying Integration Behavior
- Identify the relevant module or component.
- Read the architecture instructions.
- Consult the graph report only when needed.
- Inspect source files before modifying code.
- Follow existing project conventions.
- Reuse established abstractions.
- Minimize unrelated changes.
- Run verified validation commands.

### Updating Tests
- Identify the relevant module or component.
- Read the architecture instructions.
- Consult the graph report only when needed.
- Inspect source files before modifying code.
- Follow existing project conventions.
- Reuse established abstractions.
- Minimize unrelated changes.
- Run verified validation commands.

## 10. Architecture Risks

### Coupled Modules
- **Web Application**: Depends on the onboard and Earth APIs, which are coupled to the web application's functionality.

### Important Dependency Relationships
- **Onboard Service**: Depends on the Earth service for synchronization, which is a critical dependency.
- **Earth Service**: Depends on the onboard service for receiving events, which is a critical dependency.

### Shared State
- **Web Application**: Shares state with the onboard and Earth services through API calls.

### Critical Execution Paths
- **Onboard Service**: The synchronization path from the onboard service to the Earth service is a critical execution path.

### Areas that Require Extra Verification
- **Web Application**: The web application's integration with the onboard and Earth services requires extra verification.

### Unknown or Uncertain Relationships
- The project's architecture is relatively simple, but there may be unknown or uncertain relationships between modules and components.

## 11. Codex Development Workflow

1. **Identify Relevant Modules**: Identify the module or component that needs to be modified.
2. **Read the Architecture Instructions**: Read the relevant section of the architecture instructions to understand the module's responsibilities and dependencies.
3. **Consult the Graph Report Only When Needed**: Use the graph report to understand the module's relationships with other modules and components.
4. **Inspect Source Files Before Modifying Code**: Inspect the source files to understand the existing implementation and identify any potential issues.
5. **Follow Existing Project Conventions**: Follow the project's coding conventions to ensure consistency and maintainability.
6. **Reuse Established Abstractions**: Reuse established abstractions and patterns to minimize the amount of code that needs to be written.
7. **Minimize Unrelated Changes**: Minimize unrelated changes to ensure that the modifications do not affect other parts of the system.
8. **Run Verified Validation Commands**: Run verified validation commands to ensure that the modifications do not introduce any issues.

## 12. Quick Reference

| Common Development Tasks | Files or Modules Likely Involved |
| --- | --- |
| Adding a Feature | Relevant module or component |
| Updating an Existing Feature | Relevant module or component |
| Refactoring Shared Code | Relevant module or component |
| Changing Application Configuration | Relevant module or component |
| Adding Dependencies | Relevant module or component |
| Modifying Integration Behavior | Relevant module or component |
| Updating Tests | Relevant module or component |

By following these instructions, the AI coding agent should be able to efficiently understand and modify the code in the `nasa-space-apps` project.
