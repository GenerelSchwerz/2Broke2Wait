# 2b2w-ts-rewrite

This project is made to skip the queue of 2b2t.

Heavy work in progress.


### Install:
1. Clone from github. https://github.com/GenerelSchwerz/2b2w-ts-rewrite
2. make a .env file at the root directory level of this folder.
    make it look like this:
    ```
    USERNAME=userrr
    EMAIL=hi@gmail.com
    PASSWORD=password
    BOT_TOKEN=token
    AUTH=microsoft
    ```
3. install all modules via ``npm i`` or ``yarn i`` (I recommend yarn)
4. build program by doing ``npm run build`` or ``yarn run build``.
    Note: you can also skip this step by doing ``npm run test`` or ``yarn run test``.
5. run compiled javascript program by doing ``npm run start`` or ``yarn run start``.


### Usage:
Currently supports CLI and Discord. You'll have to figure it out as I have to go to the gym right now.

    CLI:
    - start
    - stop
    - pingtime (host, port)
    - qinfo
    - qpos
    - qhistory

    Discord:
        you'll see when you invite the bot.