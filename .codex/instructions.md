# Project Architecture: nasa-space-apps

> Generated locally using Graphify and Ollama.
> Updated: 2026-11-14 19:55:21
>
> This document summarizes the architecture to support
> efficient development with Codex.
>
> Always validate this documentation against source code.
> Graphify relationships may be inferred or outdated.

---
## 1. Project Overview

### Project Purpose
The `nasa-space-apps` project aims to build a minimal viable product (MVP) for a space health telemetry system. The system will simulate the collection, processing, and delivery of health data from astronauts on a simulated space mission.

### Main Functionality
- **Onboard Service**: Collects telemetry data from a wearable emulator, processes it, and stores it locally.
- **Crew Dashboard**: Displays the current health status, trends, and deviations from personal baselines for each astronaut.
- **Earth Service**: Receives and processes telemetry data from the onboard service, and provides a view for flight surgeons.

### Languages and Frameworks
- **Python**: The primary programming language.
- **FastAPI**: A web framework for building APIs.
- **SQLAlchemy**: An ORM for database interactions.
- **PostgreSQL**: The database management system.
- **Docker**: Containerization for development and deployment.

### Runtime and Execution Environment
- **Docker Compose**: Used to manage multi-container Docker applications.
- **Local Development**: Run services locally using Docker Compose.
- **CI/CD**: Not detailed in the provided context.

### Relevant Architectural Decisions
- **Separate Databases**: Onboard and Earth services use separate PostgreSQL databases to ensure data isolation.
- **Outbox Pattern**: Used for reliable message delivery from the onboard service to the Earth service.
- **Bearer Token Authentication**: Ensures that only authorized endpoints can access certain functionalities.

## 2. Architecture Overview

### Architectural Pattern
The project follows a microservices architecture, with two main services: `onboard` and `earth`.

### Application Layers
- **Presentation Layer**: Exposes APIs for the onboard and Earth services.
- **Business Logic Layer**: Contains the core logic for data processing and synchronization.
- **Data Access Layer**: Handles database interactions.

### Main Entry Points
- **Onboard Service**: Exposes endpoints for telemetry data ingestion and processing.
- **Earth Service**: Exposes endpoints for receiving and processing telemetry data.

### Dependency Direction
- **Onboard Service**: Depends on the `earth` service for sending telemetry data.
- **Earth Service**: Depends on the `onboard` service for receiving telemetry data.

### Module Organization
- **Onboard Service**: Contains modules for telemetry data ingestion, processing, and synchronization.
- **Earth Service**: Contains modules for receiving, processing, and displaying telemetry data.

### Relevant Integrations
- **Database**: PostgreSQL for storing telemetry data.
- **API Gateway**: FastAPI for exposing RESTful APIs.
- **Outbox Pattern**: For reliable message delivery between services.

## 3. Module Responsibilities

| Module or Component | Relevant File Paths | Responsibility | Dependencies | When Codex Should Inspect It |
|---------------------|---------------------|----------------|--------------|------------------------------|
| **Onboard Service** | - `app/onboard/app/main.py`<br>- `app/onboard/app/ingest/`<br>- `app/onboard/app/sync/`<br>- `app/onboard/app/views/` | Handles telemetry data ingestion, processing, and synchronization. | - `earth` service<br>- `database` | Always |
| **Earth Service** | - `app/earth/app/main.py`<br>- `app/earth/app/views/` | Receives and processes telemetry data. | - `onboard` service<br>- `database` | Always |
| **Database** | - `app/common/src/hub_common/database.py`<br>- `app/onboard/migrations/`<br>- `app/earth/migrations/` | Manages database connections and migrations. | - `sqlalchemy` | Always |
| **API Gateway** | - `app/common/src/hub_common/app_factory.py`<br>- `app/onboard/app/main.py`<br>- `app/earth/app/main.py` | Exposes RESTful APIs. | - `fastapi` | Always |
| **Outbox Pattern** | - `app/onboard/app/sync/worker.py`<br>- `app/onboard/app/sync/store.py` | Ensures reliable message delivery. | - `database` | Always |

## 4. Execution and Data Flows

### Entry Points
- **Onboard Service**: `app/onboard/app/main.py`
- **Earth Service**: `app/earth/app/main.py`

### Function or Component Interactions
- **Onboard Service**:
  - Ingests telemetry data from the emulator.
  - Processes the data and stores it locally.
  - Sends telemetry data to the Earth service using the outbox pattern.
- **Earth Service**:
  - Receives telemetry data from the onboard service.
  - Processes the data and stores it locally.
  - Displays the data in the crew dashboard.

### State and Data Movement
- **Onboard Service**: Telemetry data is ingested, processed, and stored locally. It then sends the data to the Earth service.
- **Earth Service**: Receives telemetry data, processes it, and stores it locally. It then displays the data in the crew dashboard.

### Backend or API Interactions When Present
- **Onboard Service**: Sends telemetry data to the Earth service using the outbox pattern.
- **Earth Service**: Receives telemetry data from the onboard service.

### Dependency Chains
- **Onboard Service**: Depends on the `earth` service for sending telemetry data.
- **Earth Service**: Depends on the `onboard` service for receiving telemetry data.

## 5. Code Organization

### Directory Structure
- `app/common/`: Shared code between the onboard and Earth services.
- `app/onboard/`: Code for the onboard service.
- `app/earth/`: Code for the Earth service.
- `app/emu/`: Code for the emulator service.
- `app/web/`: Code for the web application.
- `app/contracts/`: Shared data contracts.

### File Naming Conventions
- Python files use snake_case for module and function names.
- Configuration files use snake_case for variable names.

### Module Boundaries
- `app/common/`: Contains shared modules and utilities.
- `app/onboard/`: Contains modules specific to the onboard service.
- `app/earth/`: Contains modules specific to the Earth service.

### Shared Components
- `app/common/src/hub_common/`: Contains shared dependencies and utilities.
- `app/common/tests/`: Contains shared test utilities.

### Reusable Services and Utilities
- `common/src/hub_common/app_factory.py`: Shared FastAPI app construction logic.
- `common/src/hub_common/auth.py`: Shared authentication logic.
- `common/src/hub_common/database.py`: Shared database connection logic.

### Configuration Organization
- `app/onboard/app/config.py`: Configuration for the onboard service.
- `app/earth/app/config.py`: Configuration for the Earth service.
- `infra/docker-compose.yml`: Configuration for Docker Compose.

## 6. Coding Conventions

### Naming
- **Classes**: PascalCase
- **Functions and Methods**: snake_case
- **Variables**: snake_case

### Functions and Methods
- Functions and methods should have clear and descriptive names.
- Use type hints for function parameters and return types.

### Classes and Interfaces
- Classes should have clear and descriptive names.
- Use type hints for class attributes and methods.

### Types
- Use type hints for all variables, function parameters, and return types.

### Error Handling
- Use try-except blocks to handle exceptions.
- Log errors using the `log_json` function.

### Imports and Exports
- Import only the necessary modules and functions.
- Use relative imports when possible.

### Component Structure
- Components should be modular and reusable.
- Use interfaces for loosely coupled components.

### State Management
- Use dependency injection for managing state.
- Avoid global state whenever possible.

### Styling
- Follow PEP 8 style guide for Python code.
- Use consistent indentation and line length.

### Dependency Injection
- Use dependency injection for managing dependencies.
- Avoid hard-coded dependencies.

## 7. Dependencies and Integrations

### Important Libraries
- `fastapi`: For building APIs.
- `sqlalchemy`: For ORM and database interactions.
- `psycopg2`: PostgreSQL database adapter for Python.
- `alembic`: Database migration tool.

### Internal Dependencies
- `app/common/src/hub_common/`: Shared code between services.
- `app/onboard/app/`: Code for the onboard service.
- `app/earth/app/`: Code for the Earth service.

### External Services
- `earth`: The Earth service for receiving telemetry data.

### Shared Modules
- `app/common/src/hub_common/app_factory.py`: Shared FastAPI app construction logic.
- `app/common/src/hub_common/auth.py`: Shared authentication logic.
- `app/common/src/hub_common/database.py`: Shared database connection logic.

### Configuration Dependencies
- `app/onboard/app/config.py`: Configuration for the onboard service.
- `app/earth/app/config.py`: Configuration for the Earth service.

### Components with Broad Impact
- `outbox pattern`: Ensures reliable message delivery between services.
- `database`: Manages data persistence.

## 8. Development Commands

### Verified Commands
- **Development**:
  ```sh
  cd app/onboard && uvicorn app.main:app --reload
  cd app/earth && uvicorn app.main:app --reload
  ```
- **Build**:
  ```sh
  uv build
  ```
- **Tests**:
  ```sh
  uv test
  ```
- **Linting**:
  ```sh
  uv lint
  ```
- **Formatting**:
  ```sh
  uv format
  ```
- **Application Execution**:
  ```sh
  uv run
  ```

## 9. Change Impact Guide

### Adding a Feature
1. Identify the relevant module.
2. Read the architecture instructions.
3. Consult the graph report if needed.
4. Inspect source files before modifying code.
5. Follow existing project conventions.
6. Reuse established abstractions.
7. Minimize unrelated changes.
8. Run verified validation commands.

### Updating an Existing Feature
1. Identify the relevant module.
2. Read the architecture instructions.
3. Consult the graph report if needed.
4. Inspect source files before modifying code.
5. Follow existing project conventions.
6. Reuse established abstractions.
7. Minimize unrelated changes.
8. Run verified validation commands.

### Refactoring Shared Code
1. Identify the relevant module.
2. Read the architecture instructions.
3. Consult the graph report if needed.
4. Inspect source files before modifying code.
5. Follow existing project conventions.
6. Reuse established abstractions.
7. Minimize unrelated changes.
8. Run verified validation commands.

### Changing Application Configuration
1. Identify the relevant module.
2. Read the architecture instructions.
3. Consult the graph report if needed.
4. Inspect source files before modifying code.
5. Follow existing project conventions.
6. Reuse established abstractions.
7. Minimize unrelated changes.
8. Run verified validation commands.

### Adding Dependencies
1. Identify the relevant module.
2. Read the architecture instructions.
3. Consult the graph report if needed.
4. Inspect source files before modifying code.
5. Follow existing project conventions.
6. Reuse established abstractions.
7. Minimize unrelated changes.
8. Run verified validation commands.

### Modifying Integration Behavior
1. Identify the relevant module.
2. Read the architecture instructions.
3. Consult the graph report if needed.
4. Inspect source files before modifying code.
5. Follow existing project conventions.
6. Reuse established abstractions.
7. Minimize unrelated changes.
8. Run verified validation commands.

### Updating Tests
1. Identify the relevant module.
2. Read the architecture instructions.
3. Consult the graph report if needed.
4. Inspect source files before modifying code.
5. Follow existing project conventions.
6. Reuse established abstractions.
7. Minimize unrelated changes.
8. Run verified validation commands.

## 10. Architecture Risks

### Coupled Modules
- `onboard` and `earth` services are tightly coupled through the outbox pattern.

### Important Dependency Relationships
- `onboard` depends on `earth` for sending telemetry data.
- `earth` depends on `onboard` for receiving telemetry data.

### Shared State
- Both services share a database for storing telemetry data.

### Critical Execution Paths
- The outbox pattern is a critical execution path for reliable message delivery.

### Areas that Require Extra Verification
- The outbox pattern implementation.
- Database migrations.

### Unknown or Uncertain Relationships
- The exact behavior of the emulator service.

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

| Common Development Tasks | Files or Modules Likely Involved |
|--------------------------|----------------------------------|
| Adding a Feature         | Relevant module and its tests    |
| Updating an Existing Feature | Relevant module and its tests    |
| Refactoring Shared Code  | Relevant module and its tests    |
| Changing Application Configuration | Configuration files and relevant modules |
| Adding Dependencies      | `pyproject.toml` and relevant modules |
| Modifying Integration Behavior | Relevant modules and their tests |
| Updating Tests           | Relevant module and its tests    |

This document provides a comprehensive overview of the `nasa-space-apps` project, including its architecture, modules, and development workflow. It should help the AI coding agent understand the project's structure and make efficient modifications.
