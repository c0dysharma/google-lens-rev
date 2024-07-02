const process = require('process');
const axios = require('axios');
const cheerio = require('cheerio');
const fsPromises = require('fs/promises')

const createBrowserless = require('browserless')
const getHTML = require('html-get')

// Spawn Chromium process once
const browserlessFactory = createBrowserless()

// Kill the process when Node.js exit
process.on('exit', () => {
  console.log('closing resources!')
  browserlessFactory.close()
})

function isValidUrl(url) {
  // Regular expression to check for a valid URL
  const urlPattern = /^(https:\/\/)?[\w.-]+\.[a-zA-Z]{2,6}(\/\S*)?$/;
  return urlPattern.test(url);
}

async function fetchHTML(url) {
  const browserContext = browserlessFactory.createContext()
  const getBrowserless = () => browserContext
  const result = await getHTML(url, { getBrowserless, headers:{
    'Referer': 'https://www.google.com/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  }, prerender: true  })

  // save the result.html result in a file
  // const tempFilePath = './result.html';
  // await fsPromises.writeFile(tempFilePath, result.html);
  // console.log(`HTML saved to ${tempFilePath}`);

  // close the browser context after it's used
  await getBrowserless((browser) => browser.destroyContext())
  return result.html
}

async function scrape(url) {
  const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(url)}`;
  try {
    const html = await fetchHTML(lensUrl)
    const $ = cheerio.load(html);

    const imageColumns = $('div.aah4tc > div')

    const imagesMatrix = []
    let maxLengthColumn = 0;

    for(const column of imageColumns) {
      const images = $(column).find('div.Me0cf img');
      const imageUrls = [];

      images.each((index, element) => {
        const imgUrl = $(element).attr('src');
        if (imgUrl && isValidUrl(imgUrl)) {
          imageUrls.push(imgUrl);
        }
      });
      imagesMatrix.push(imageUrls);

      maxLengthColumn = Math.max(imageUrls.length, maxLengthColumn)
    }

    const resultImgesInOrder = [];
    for (let i = 0; i < maxLengthColumn; i++) {
      for(const column of imagesMatrix){
        if(i<column.length){
          resultImgesInOrder.push(column[i]) 
        }
      }
    }

    return resultImgesInOrder;
  } catch (error) {
    console.error(`Error scraping the URL: ${error}`);
    return null;
  }
}

async function processUrl(url) {
  if (isValidUrl(url)) {
    return await scrape(url);
  } else {
    console.error('Error: Invalid URL');
    return null;
  }
}

// Get the URL from command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Error: No URL provided');
  process.exit(1);
}

const url = args[0];
processUrl(url).then((result) => {
  if (result !== null) {
    console.log(result);
  }
  process.exit(0);
});