var fs = require('fs');//write output file
var request = require('request');//request http
var cheerio = require('cheerio');//cheerio
var Promise = require("bluebird");//promise all
var HOME_URL = 'https://www.bankmega.com/';
var BASE_URL = HOME_URL + 'promolainnya.php';
var categories = []
var pageOfCategory = {}
var subcatOfCategory = {}
var linkOfCategory = {}
var cellOfCategory = {}
function crawlerCategories($) {
    return $('#subcatpromo div img').map(function(index) {
        var categoryName = $(this).attr('title');
        subcatOfCategory[categoryName] = index+1;
        return categoryName;
    }).get();
}

function crawlerCategoryEndPage($) {
    return $('.page_promo_lain').eq(1).attr('title').match(/\d+/g).map(Number).pop();
}

function crawlerCategoryName($) {
    return $('#subcatselected img').attr('title')
}

function crawlerCellLink($) {
    return $('#promolain li a').map(function() {
        var subURL = $(this).attr('href');
        // return subURL.includes('http')?subURL+"--"+page+'hint___'+crawlerCategoryName($)+$('.page_promo_lain').eq(1).attr('title'): HOME_URL + subURL;
        return subURL.includes('http')?subURL:HOME_URL + subURL;
    }).get();
}

function crawlerCellDetail($) {
    cellJson = {}
    cellJson['title'] = $('.titleinside h3').text();
    cellJson['period'] = $('.periode b').text();
    cellJson['area'] = $('.area b').text();
    cellJson['image'] = $('.keteranganinside img').attr('src');
    return cellJson
}


function writeOutput(data) {
    fs.writeFile('solution.json', data, function (err) {
        if (err) throw err;
        console.log('Saved!');
      });
}

function getData(html) {
    console.time('runTime');
    var $ = cheerio.load(html);
    //category
    categories = crawlerCategories($)

    var promiseCategories = [];
    for (i=1; i<=categories.length; i++) {
        var subcat = i;
        var taskCategory = new Promise(function(resolve, reject) {
            var pageEnd = 1;
            //step 1: get data from pageStart=1 then find the value of pageEnd of each Category
            var pageStart = 1;
            var categoryURL = BASE_URL+'?'+'subcat='+subcat+'&'+'page='+pageStart;
            request(categoryURL,function(error, response, html) {
                if(!error && response.statusCode == 200) {
                    resolve(html);
                }
                resolve();
            })
        });
        taskCategory.then(function(html) {
            var $ = cheerio.load(html);
            pageEnd = crawlerCategoryEndPage($);
            categoryName = crawlerCategoryName($);
            pageOfCategory[categoryName] = pageEnd
        });
        promiseCategories.push(taskCategory);
    }
    

    return Promise.all(promiseCategories).then(function(results) {
        // writeOutput(JSON.stringify(pageOfCategory));
        getDataCells();
    }, function(err) {
        // writeOutput('error: '+err);
    });
}

function getDataCells() {
    //step 2: loop from pageStart to the pageEnd

    var promisePages = [];
    categories.forEach(function(category){
        //fucking code
        pageStart = 1;
        pageEnd = pageOfCategory[category];
        subcat = subcatOfCategory[category];
        linkOfCategory[category] = [];
        for (p=pageStart; p<=pageEnd; p++) {
            var taskPage = new Promise(function(resolve, reject) {
                var categoryURL = BASE_URL+'?'+'subcat='+subcat+'&'+'page='+p;
                
                request(categoryURL, function(error, response, html) {
                    if(!error && response.statusCode == 200) {
                        resolve(html)
                    }
                })
            });
            taskPage.then(function(html) {
                var $ = cheerio.load(html);
                linkOfCategory[category] = linkOfCategory[category].concat(crawlerCellLink($));
            });
            promisePages.push(taskPage);
        }

        //end fucking code
    });
    Promise.all(promisePages).then(function(results) {
        console.log('--linkdone');
        // writeOutput(JSON.stringify(linkOfCategory));
        getDataCellInfos();
    }, function(err) {
        console.log('sub error: '+err);
    });
}

function getDataCellInfos(){
    //step 3: loop all link group by category

    var promiseCells = [];
    // categories
    // ['Travel','Lifestyle']
    categories.forEach(function(category){
        //fucking code
        console.log("--linkOfCategory["+category+"]___"+linkOfCategory[category]);
        cellOfCategory[category] = [];
        linkOfCategory[category].forEach(function(linkCell) {
                var taskCell = new Promise(function(resolve, reject) {
                    console.log("----["+category+"]___"+linkCell);
                    request(linkCell, function(error, response, html) {
                        if(!error && response.statusCode == 200) {
                            resolve(html)
                        }
                        resolve();
                    });
                });
                taskCell.then(function(html) {
                    if(html) {
                        var $ = cheerio.load(html);
                        // console.log(crawlerCellDetail($));
                        cellOfCategory[category].push(crawlerCellDetail($));
                    }
                });
                promiseCells.push(taskCell);
            })
        })

        //end fucking code
    // });
    Promise.all(promiseCells).then(function(results) {
        console.log('--celldone-------------------------------------------------------');
        console.timeEnd('runTime');
        writeOutput(JSON.stringify(cellOfCategory));
    }, function(err) {
        console.log('sub error: '+err);
    });
}

request(BASE_URL,function(error, response, html) {
    if(!error && response.statusCode == 200) {
        getData(html);
    }
})
