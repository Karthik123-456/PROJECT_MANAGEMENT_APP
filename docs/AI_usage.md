# AI Usage

AI tools were used as development assistants while building and documenting
Project Manager. They support the development process; they are not part of the
application's runtime architecture, and the app does not call an AI service.

## 1. Core AI Capabilities & Features

The development work used **Claude Sonnet 5.5** and **GitHub Copilot 0.41** to
assist with:

- Exploring implementation approaches and refining feature requirements.
- Drafting and improving application code, tests, and technical documentation.
- Investigating errors by tracing code paths and interpreting test, build, and
  runtime output.
- Reviewing changes for consistency with existing patterns, API contracts, and
  project requirements.
- Improving clarity and completeness of project guides, including setup, API,
  architecture, schema, security, and roadmap documentation.

AI-generated suggestions were treated as proposals rather than authoritative
results. Code and documentation were reviewed against the repository and
validated with appropriate tests, lint checks, builds, or direct inspection.

## 2. Development Workflow & Tooling

- **GitHub Copilot 0.41** was used in the development environment for
  coding-oriented assistance, such as code suggestions, explanations, and
  targeted edits.
- **Claude Sonnet 5.5** was used for conversational assistance with planning,
  reasoning through implementation choices, debugging, and drafting or
  reviewing documentation.
- The normal development tools remained authoritative: the source repository,
  package scripts, test results, lint output, and production build.
- Changes were checked in context and revised when tests or type checks exposed
  problems. AI output was not accepted as a substitute for verification.
- AI tools are not required to install, run, test, or deploy the application.

Do not provide AI tools with production credentials, private keys, real user
data, or other sensitive information. Keep secrets in local environment
configuration and out of prompts and source control.