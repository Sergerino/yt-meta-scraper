import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import csv from 'csv-parser';
import readline from 'readline';
import path from 'path';

puppeteer.use(StealthPlugin());

const cookiesPath = './cookies.json';

interface ElementData {
    subscriberCount: string;
    videosCount: string;
    channelName: string;
}

const readUrlsFromCsv = async (csvFilePath: string): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const urls: string[] = [];
        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (row: { url: string }) => {
                urls.push(row.url);
            })
            .on('end', () => {
                resolve(urls);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
};

const main = async () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Enter path to CSV file(example.csv): ', async (csvFilePath: string) => {
        rl.close();

        try {
            const urls = await readUrlsFromCsv(csvFilePath);
            const scrapedData: ElementData[] = [];

            for (const url of urls) {
                const browser = await puppeteer.launch({
                    headless: false,
                    args: [
                        '--no-sandbox',
                        '--disable-web-security',
                    ]
                });
                const page = await browser.newPage();

                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.9999.999 Safari/537.36');

                const cookies = fs.existsSync(cookiesPath) ? JSON.parse(fs.readFileSync(cookiesPath, 'utf-8')) : [];

                if (cookies.length > 0) {
                    await page.setCookie(...cookies);
                }

                await page.goto(url);

                await page.waitForSelector('#subscriber-count');
                await page.waitForSelector('#videos-count');
                await page.waitForSelector('ytd-channel-name #text');

                const elementData: ElementData = await page.evaluate(() => {
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

                scrapedData.push(elementData);

                console.log('URL:', url);
                console.log('Subscriber count:', elementData.subscriberCount);
                console.log('Videos count:', elementData.videosCount);
                console.log('Channel name:', elementData.channelName);

                const pageCookies = await page.cookies();
                fs.writeFileSync(cookiesPath, JSON.stringify(pageCookies));

                await browser.close();
            }

            const csvFileName = path.basename(csvFilePath);
            const outputJsonFileName = `output-${csvFileName}.json`;

            // Write scraped data to JSON file
            fs.writeFileSync(outputJsonFileName, JSON.stringify(scrapedData, null, 2));
            console.log('Scraped data has been written to:', outputJsonFileName);

        } catch (error) {
            console.error('Error:', error);
        }
    });
};

main();
