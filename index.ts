const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const readline = require('readline');

puppeteer.use(StealthPlugin());

const cookiesPath = './cookies.json';

const main = async () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Enter the URL you want to get info from: ', async (url: string) => {
        rl.close();

        let cookies;
        if (fs.existsSync(cookiesPath)) {
            cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
        }

        const browser = await puppeteer.launch({
            headless: false, // lance false pour accepter cookies, puis de-activer
            args: [
                '--no-sandbox', 
                '--disable-web-security', 
            ]
        });
        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.9999.999 Safari/537.36');

        if (cookies) {
            await page.setCookie(...cookies);
        }

        await page.goto(url);

        await page.waitForSelector('#subscriber-count');
        await page.waitForSelector('#videos-count');
        await page.waitForSelector('ytd-channel-name #text');

        const elementData = await page.evaluate(() => {
            const parseVideoCount = (countString: string) => {
                return countString.trim();
            };

            const subscriberCountElement = document.querySelector('#subscriber-count') as HTMLElement;
            const videosCountParentElement = document.querySelector('#videos-count') as HTMLElement;
            const videosCountElement = videosCountParentElement?.querySelector('.style-scope.yt-formatted-string') as HTMLElement;
            const channelNameElement = document.querySelector('ytd-channel-name #text') as HTMLElement;

            const subscriberCount = subscriberCountElement ? subscriberCountElement.innerText.trim() : 'Subscriber count not found';
            const videosCountText = videosCountElement ? videosCountElement.innerText.trim() : 'Videos count not found';
            const channelName = channelNameElement ? channelNameElement.innerText.trim() : 'Channel name not found';

            const videosCount = parseVideoCount(videosCountText);

            return { subscriberCount, videosCount, channelName };
        });

        console.log('URL:', url);
        console.log('Subscriber count:', elementData.subscriberCount);
        console.log('Videos count:', elementData.videosCount);
        console.log('Channel name:', elementData.channelName);

        const pageCookies = await page.cookies();
        fs.writeFileSync(cookiesPath, JSON.stringify(pageCookies));

        await browser.close();
    });
}

main();
