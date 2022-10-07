
/**
 * Files
 */
const fs = require("fs")
const assert = require('assert');

class Files {
        
    /**
     * Write a json file for the givem object list
     * @param {String} _fileName 
     * @param {Object[]} _objectList 
     * @returns 
     */
    static async serializeObjectListToJson(_fileName, _objectList){
        assert(_fileName !== undefined, "Error: _fileName is not fulfilled!");
        assert(_objectList !== undefined, "Error: _objectList is not fulfilled!");

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

    static deleteFile(_fileName){
        if (fs.existsSync(_fileName)) {
            fs.unlinkSync(_fileName);
        } else {
            console.log('Error: file not found = '+_fileName);
        }        
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

    

        
}
module.exports = Files;