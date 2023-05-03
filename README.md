# 2Broke2Wait

This project is made to skip the queue of 2b2t.

Heavy work in progress.

## Install:

There are multiple ways to install this version of 2Broke2Wait

### Native install (NodeJS)

1. Download Node16. (This is mandatory)
2. Download our repository. _Top right, green button, click that. Then "download zip"._
3. run "npm i" or any other package manager to install packages.
4. run "npm run build"
5. run "npm run start"

### Executable install (Binary)

1. Go here: https://github.com/GenerelSchwerz/2b2w-ts-rewrite/actions
2. Click the top-most action
3. Scroll down a bit, see "Artifacts"
4. Click the one that matches your operating system


## Configuration:

Everything to configure is available under `options.json`.
Simply edit that, the names are self-evident.

There are also hardcoded options deeper within the files, I will soon update those to be read from the configuration file.

## Usage:

Currently supports CLI, a discord bot for commands, and discord webhooks for info.

    CLI:
    - "help" lists a command list.

    Discord:
    - commands are slash commands, see full list there.

    Webhooks:
    - Webhooks do not have commands, they only provide info.

### Roadmap:

    1. Predict Queue time.
      - Currently iffy, but more accurate than 2b2t's standard prediction
    2. Log data appropiately.
      - Interface is rough, will update when more people start using it

### Known Issues:

1. Program's strong event structure is ugly

