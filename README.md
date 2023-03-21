# 2b2w-ts-rewrite

This project is made to skip the queue of 2b2t.

Heavy work in progress.

### Install:
1. Download Node16.
2. Download our repository.
3. run "npm run build"
4. run "npm run start"

### configuration:
Everything to configure is available under `options.json`.
Simply edit that, the names are self-evident.

There are also hardcoded options deeper within the files, I will soon update those to be read from the configuration file.


### Usage:
Currently supports CLI, a discord for commands, and discord webhooks for info.

    CLI:
    - "help" lists a command list.

    Discord:
    - commands are slash commands, see full list there.


### Roadmap:

    1. Predict Queue time.
      - Currently iffy, but more accurate than 2b2t's standard prediction
    2. Log data appropiately.
      - Interface is rough, will update when more people start using it
