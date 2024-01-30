#! /usr/bin/env node

const path = require('path')
const glob = require('glob');
const fs = require('fs');

const args = process.argv.slice(2);
const currentDir = process.cwd();

if (args.length < 1) {
    console.error('Please enter the contract name');
    process.exit(1);
}

glob(`**/${args[0]}.sol/${args[0]}.json`, null, function (er, files) {
    if (files.length > 1) {
        console.error('There are multiple contract files');
        process.exit(1);
    } else if (files.length < 0) {
        console.error('There are no contract file');
        process.exit(1);
    }

    let finalOut = `
import { formatEther, Contract } from 'ethers';

class ${args[0]}Wrapper {

    constructor(contractAddress, contractAbi, signer) {
        this.contract = new Contract(contractAddress, contractAbi, signer);
    }
    `
    const contractJson = JSON.parse(fs.readFileSync(files[0]))
    const functionData = contractJson.abi.filter(x => x.type == 'function' && ["nonpayable","view","payable","pure"].includes(x.stateMutability))

    for (const functionInfo of functionData) {
        const paraData =  functionInfo.inputs.map((x,index) => x.name.length ? x.name:`para${index}`);

        const haveOption = functionInfo.stateMutability == "payable"

        if (haveOption) {
            paraData.push('option')
        }

        finalOut += `
    async ${functionInfo.name}(${paraData.join(', ')}) {
        return this.convertData(await this.contract.${functionInfo.name}(${paraData}${haveOption?',option':''}))
    }
        `
    }

    finalOut += `
    convertData(data) {
        if (typeof data == 'bigint') {
            if (data > 10000000000n) {
                return formatEther(data);
            }
            return Number(data)
        }
        if (data instanceof Object && typeof data.length == 'number') {
            const allData = []
            for (const key of data) {
                allData.push(this.convertData(key))
            }
            return allData
        } else if (data instanceof Object) {
            const allData = {}
            for (const key in data) {
                if (!(parseInt(key) > -1))
                    allData[key] = this.convertData(data[key])
            }
            return allData
        }
        return data
    }
}

export default ${args[0]}Wrapper
`
    fs.writeFileSync(path.join(args[1],`${args[0]}Wrapper.js`),finalOut)
})
