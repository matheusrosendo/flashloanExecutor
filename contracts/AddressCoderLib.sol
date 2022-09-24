pragma solidity ^0.8.0;
library AddressCoder{
    function bytesToAddress(bytes calldata data) private pure returns (address addr) {
        bytes memory b = data;
        assembly {
          addr := mload(add(b, 20))
        } 
    }

    
    function decodeAddressArray(bytes calldata data)external pure returns(address[] memory addresses){
        uint n = data.length/20;
        addresses = new address[](n);
        
        for(uint i=0; i<n; i++){
            addresses[i] = bytesToAddress(data[i*20:(i+1)*20]);
        }
    }
    
    
    function encodeAddressArray(address[] calldata addresses) external pure returns(bytes memory data){
        for(uint i=0; i<addresses.length; i++){
            data = abi.encodePacked(data, addresses[i]);
        }
    }
}