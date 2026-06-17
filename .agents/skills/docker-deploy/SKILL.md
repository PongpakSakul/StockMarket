---
name: "docker-deploy"
description: "Used for managing Docker containers, building, running, and deploying the stock market app services."
---

# Docker Deploy Skill

This skill outlines how to build, run, and manage Docker containers for the StockMarket project.

## Prerequisites
- Make sure `.env` is configured correctly. Refer to `.env.example`.

## Commands
- **Start Services:** `docker-compose up -d --build`
- **Stop Services:** `docker-compose down`
- **Check Logs:** `docker-compose logs -f`
- **Check Container Status:** `docker-compose ps`
