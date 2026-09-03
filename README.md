# Claude Code Skills

A collection of reusable skills for [OpenCode](https://opencode.ai). Each skill extends OpenCode with specialized workflows and tools.

## Skills

| Skill | Description | Status |
|-------|-------------|--------|
| [remote-dev](remote-dev/) | Remote development workflow — edit locally, run on a remote machine, screenshot the result | Stable |

## Installation

1. Clone this repo:
   ```bash
   git clone https://github.com/Ibra106i/claude-code-skills.git
   ```

2. Copy the skill(s) you want into your OpenCode config:
   ```bash
   # Example: install remote-dev skill
   cp -r claude-code-skills/remote-dev ~/.config/opencode/skills/
   cp claude-code-skills/remote-dev/laptop-tools.ts ~/.config/opencode/plugins/
   ```

3. Add the skill and plugin to your `opencode.jsonc`:
   ```jsonc
   {
     "plugin": ["laptop-tools"],
     "permission": {
       "ssh": { "*": "allow" }
     }
   }
   ```

4. Configure the skill for your environment (see each skill's README).

## Adding a New Skill

Each skill follows this structure:

```
skill-name/
├── SKILL.md          # Main instructions (required)
├── README.md         # Setup & usage guide
└── [scripts/tools]   # Supporting files
```

To add a new skill:

1. Create a folder with the skill name
2. Write a `SKILL.md` with frontmatter (`name`, `description`) and instructions
3. Add a `README.md` with setup steps
4. Submit a PR

## License

MIT
