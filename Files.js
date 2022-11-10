
/**
 * Files
 */
 const fs = require("fs");
 const csvParser =  require("csv-parser");
 const assert = require('assert');
 const Util = require("./Util.js");
 const path = require("path");
 
 class Files {
     /**
      * Take all tokens on the json token file and fulfill a list 
      * @param {String} _initialToken optional 
      * @returns list of tokens from json file 
      * 
      */
     static readTokenListFromJsonFile = async (_initialToken, _file) => {
         //console.log("###### Parsing tokens from json file ######")
         //open the token list file
         const promise = new Promise(function (resolve, reject) {  
             fs.readFile(_file, "utf8", (err, jsonString) =>{
                 if(err){
                     reject("Error reading file "+_file);
                 }                    
                 try {
                     let response = JSON.parse(jsonString);                
                     resolve(response);
                 } catch (err) {
                     reject("Error parsing JSON String "+ err);
                 }
             });
         }); 
         //add a TOKEN_END
         let result = promise.then((response)=>{
             try {
                 let tokenList = response.tokenList;
                 if(_initialToken !== undefined && _initialToken !== null ){
                     let indexInicialToken = getItemFromTokenList("symbol", _initialToken, tokenList).index
                     if(indexInicialToken > -1){
                         tokenList.push({"symbol":_initialToken+"_END", "address":tokenList[indexInicialToken].address, "decimals": tokenList[indexInicialToken].decimals})
                     } 
                 }
                 return tokenList;
             } catch (error) {
                 console.log("Error parsing token list: "+error);
             }
             
         }, (reject) =>{throw new Error(reject)});  
         let resolvedPromise = await Promise.resolve(result)
         return resolvedPromise;
     }
 
     
     /**
      * Read CSV file with a matrix and fullfill an array list
      * @returns array [][]
      */
     static readFromCSVtoMatrix = (_fileName) => {
         console.log("###### Reading CSV file with the matrix pair prices ######")
         matrixPrice = [];
         const promise = new Promise(function(resolve, reject) {
             try {
                 fs.createReadStream(_fileName)
                 .pipe(csvParser())
                 .on("data", (data) => matrixPrice.push(data))
                 .on("end", () => {
                     resolve();
                 }).on('error', function(err) {
                     reject("Error parsing CSV file "+ err);
                 });
             } catch (err) {
                 reject("Error opening CSV file "+ err);
             }        
         });
         return promise;
     }
     
     
     /**
      * Read CSV file with the matrix of all pair token prices and fullfill {matrixPrice}
      * @returns 
      */
     static readMatrixFromCVSfile = async (_file, _tokenListFile) => {
         console.log("###### Reading pair prices matrix CSV file:"+_file+" ######")
         matrixPrice = [];
         const promise = new Promise(function(resolve, reject) {
             try {
                 fs.createReadStream(_file)
                 .pipe(csvParser())
                 .on("data", (data) => matrixPrice.push(data))
                 .on("end", () => {
                     resolve(matrixPrice);
                 }).on('error', function(err) {
                     reject("Error parsing CSV file "+ err);
                 });
             } catch (err) {
                 reject("Error opening CSV file "+ err);
             }        
         });
         
 
         let result = promise.then((response)=>{return response}, (reject) =>{throw new Error(reject)}); 
         let resolvedPromise = await Promise.resolve(result)
         return {"matrix":resolvedPromise, "tokenList": parseJSONtoOjectList(_tokenListFile)};
     }
 
 
     /**
      * Read CSV file with the matrix of all pair token prices and fullfill {matrixPrice}
      * @returns 
      */
     static readPairReservesFromCVSfile = async (_file, _tokenListFile) => {
         console.log("###### Reading pair prices matrix CSV file:"+_file+" ######")
         matrixPrice = [];
         const promise = new Promise(function(resolve, reject) {
             try {
                 fs.createReadStream(_file)
                 .pipe(csvParser())
                 .on("data", (data) => {
                     console.log(data);
                     matrixPrice.push(data)
                 })
                 .on("end", () => {
                     resolve(matrixPrice);
                 }).on('error', function(err) {
                     reject("Error parsing CSV file "+ err);
                 });
             } catch (err) {
                 reject("Error opening CSV file "+ err);
             }        
         });
         
 
         let result = promise.then((response)=>{return response}, (reject) =>{throw new Error(reject)}); 
         let resolvedPromise = await Promise.resolve(result)
         return {"matrix":resolvedPromise, "tokenList": parseJSONtoOjectList(_tokenListFile)};
     }
 
 
     /**
      * Read CSV file with the matrix of all pair token prices and fullfill {matrixPrice}
      * @returns 
      */
     static readPairReservesFromJsonfile = async (_pairReservesfile, _tokenListFile) => {
         console.log("###### Reading pair reserves and token list files:"+_pairReservesfile+" "+_tokenListFile+"######")
         return {"matrix":parseJSONtoOjectList(_pairReservesfile), "tokenList": parseJSONtoOjectList(_tokenListFile)};
     }
 
     
     
     /**
      * Write a json file for the givem object list
      * @param {String} _fileName 
      * @param {Object[]} _tokenList 
      * @returns 
      */
     static async serializeObjectListToJson(_fileName, _objectList){
         assert(_fileName, "Error: _fileName is not fulfilled!");
         assert(_objectList, "Error: _objectList is not fulfilled!");
     
         console.log("###### Writing object list to JSON file:"+_fileName+" ######")
         
         let reservesPromise = new Promise((resolve, reject) =>{
             fs.writeFile(_fileName, JSON.stringify(_objectList, null, 2), 'utf8', (err)=>{
                 if(err){
                     reject("Error saving file "+_fileName+": "+err)
                 } else {
                     resolve();
                 }
             });
         });
         let resolvedPromiseReserves = await Promise.resolve(reservesPromise);
         
         return resolvedPromiseReserves;
     }

    /**
     * Write a json file for the givem object list
     * @param {String} _fileName 
     * @param {Object[]} _tokenList 
     * @returns 
     */
    static serializeObjectListToJsonPromise(_fileName, _objectList){
        assert(_fileName, "Error: _fileName is not fulfilled!");
        assert(_objectList, "Error: _objectList is not fulfilled!");
    
        console.log("###### Writing object list to JSON file:"+_fileName+" ######")
        
        let writingFilePromise = new Promise((resolve, reject) =>{
            fs.writeFile(_fileName, JSON.stringify(_objectList, null, 2), 'utf8', (err)=>{
                if(err){
                    reject("Error saving file "+_fileName+": "+err)
                } else {
                    resolve();
                }
            });
        });
        return writingFilePromise;
    }
 
     /**
      * Write a json file for the givem object list
      * @param {String} _fileName 
      * @param {Object[]} _tokenList 
      * @returns 
      */
      static async serializeObjectListToLogFile(_file, _objectList){
         assert(_objectList, "Error: _tokenList is not fulfilled!");
         
         console.log("###### Writing Log file:"+_file+" ######")
         
         let reservesPromise = new Promise((resolve, reject) =>{
             fs.writeFile(_file, JSON.stringify(_objectList, null, 2), 'utf8', (err)=>{
                 if(err){
                     reject("Error saving file "+_file+": "+err)
                 } else {
                     resolve();
                 }
             });
         });
         let resolvedPromiseReserves = await Promise.resolve(reservesPromise);
         
         return resolvedPromiseReserves;
     }
 
     /**
      * Fill a object list from a json file 
      * @param {*} _file 
      * @returns 
      */
     static parseJSONtoOjectList(_file){
         let objList;
         try {
             let fileContent = fs.readFileSync(_file, 'utf8');
             objList  = JSON.parse(fileContent); 
         } catch (error) {
             console.log("Error trying to read "+_file+" | "+error);
         }    
         return objList;
     }
 
     /**
      * Fill a object list from a json file 
      * @param {*} _file 
      * @returns 
      */
      static fileExists(_file){
         let fileFound = false;
         try {
             if (fs.existsSync(_file)) {
                 fileFound = true;
             }
         } catch (error) {
             console.log("Error trying to read "+_file+" | "+error);
         }    
         return fileFound;
     }
 
     /**
      * delete given file 
      */
     static deleteFile(_fileName){
         if (fs.existsSync(_fileName)) {
             fs.unlinkSync(_fileName);
         } else {
             console.log('Error: file not found = '+_fileName);
         }        
     }
 
     /**
      * search for files on the given folder name passed as parameter
      * @param {*} _folderPath 
      * @returns 
      */
      static listFiles(_folderPath){
         let filesNames;
         try {
             let dirents = fs.readdirSync(_folderPath, { withFileTypes: true });
             filesNames = dirents
             .filter(dirent => dirent.isFile())
             .map(dirent => dirent.name);
         } catch (error) {
             console.log("Error trying to list files in "+_folderPath+" | "+error);
         }        
         return filesNames
     }

    /**
     * Save file with the result of a flashloan execution
     * @param {*} _response 
     * @param {*} _parsedJson 
     * @param {*} _inputFileName 
     * @param {*} _outputFolder 
     * @returns 
     */ 
    static async serializeFlashloanResult(_response, _parsedJson, _inputFileName, _outputFolder, _oldBalance, _newBalance){
        let serializedFile;

        try {
            let profit = _newBalance - _oldBalance; 
            //get result data
            let result = {
                status: _response.status,
                details: _response.details,
                flashloanProtocol: _response.flashloanProtocol,
                tx: _response.transactionHash,
                blockNumber: _response.blockNumber,
                tokenBorrowed: _parsedJson.flashloanInputData.swaps[0].tokenInAddress,
                oldBalance: _oldBalance,
                newBalance: _newBalance,
                profit: profit,
                gasUsed: _response.gasUsed,
                txCost: _response.txCost
            }
            _parsedJson.result = result;
            
            //define new file name and serialize it
            let originalFileArr = _inputFileName.split("\\");
            let originalFileName = originalFileArr[originalFileArr.length-1];
            let newFileName = originalFileName.split(".")[0];
            newFileName = newFileName + "_exec_"+Util.formatTimeForFileName(new Date())+".json";
            let fileNameEntirePath = path.join(_outputFolder, newFileName);
            
            await Files.serializeObjectListToJson(fileNameEntirePath, _parsedJson);
            let testSerializedFile = Files.parseJSONtoOjectList(fileNameEntirePath);
            if(testSerializedFile !== undefined && testSerializedFile !== null){
                serializedFile = {};
                serializedFile.content = testSerializedFile;
                serializedFile.location = fileNameEntirePath;
            }
        } catch (error) {
            throw new Error(`Error serializing log file: ${error} `);  
        }
        return serializedFile;
    }
 
         
 }
 module.exports = Files;