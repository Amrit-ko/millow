//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IERC721 {
    function transferFrom(
        address _from,
        address _to,
        uint256 _id
    ) external;
}

contract Escrow {
    address payable public seller;
    address public nftAddress;
    address public inspector;
    address public lender;
    mapping(uint256 => bool) public isListed;
    mapping(uint256 => uint256) public purchasePrice;
    mapping(uint256 => uint256) public escrowAmount;
    mapping(uint256 => address) public buyer;
    mapping(uint256 => bool)  public inspectionPassed;
    mapping(uint256 => bool) public inspectionDone;
    mapping(uint256 => mapping(address => bool)) public approval;

    constructor(
        address _nftAddress,
        address payable _seller,
        address _inspector,
        address _lender
    ) {
        nftAddress = _nftAddress;
        seller = _seller;
        inspector = _inspector;
        lender = _lender;
    }
    modifier onlySeller() {
        require(msg.sender == seller, 'You are not the Seller');
        _;
    }
    modifier onlyBuyer(uint256 _nftId) {
        require(msg.sender == buyer[_nftId], "You are not the Buyer");
        _;
    }

    modifier onlyInspector() {
        require(msg.sender == inspector, "You are not an Inspector");
        _;
    }

    function list(
        uint256 _nftId,
        address _buyer,
        uint256 _purchasePrice,
        uint256 _escrowAmount
    ) public payable onlySeller {
        IERC721(nftAddress).transferFrom(msg.sender, address(this), _nftId);
        isListed[_nftId] = true;
        purchasePrice[_nftId] = _purchasePrice;
        buyer[_nftId] = _buyer;
        escrowAmount[_nftId] = _escrowAmount;
    }

    function depositEarnest(uint256 _nftId) public payable onlyBuyer(_nftId) {
        require(msg.value >= escrowAmount[_nftId]);
    }

    function updateInspectionStatus(uint256 _nftId, bool _passed) public onlyInspector {
        inspectionPassed[_nftId] = _passed;
        inspectionDone[_nftId]= true;
    }

    function approve(uint256 _nftId) public {
        approval[_nftId][msg.sender] = true;
    }

   
    function cancelSale(uint256 _nftId) public onlyBuyer(_nftId) {
        if (inspectionDone[_nftId]==true && inspectionPassed[_nftId]==false) {
           (bool success, ) = payable(buyer[_nftId]).call{value: address(this).balance}("");
           require(success); 
        } else {
           (bool success, ) = payable(seller).call{value: address(this).balance}("");
           require(success);
        }
        
    }

    function finalizeSale(uint256 _nftId) public {
        require(inspectionPassed[_nftId]);
        require(approval[_nftId][buyer[_nftId]]);
        require(approval[_nftId][seller]);
        require(approval[_nftId][lender]); 
        require(address(this).balance >= purchasePrice[_nftId]);
        
        (bool success, ) = payable(seller).call{value: address(this).balance}("");
        require(success);

        isListed[_nftId]=false;

        IERC721(nftAddress).transferFrom( address(this), buyer[_nftId],_nftId);
    }

    receive() external payable {}

    function getBalance() public view returns(uint256) {
        return address(this).balance;
    }

}
