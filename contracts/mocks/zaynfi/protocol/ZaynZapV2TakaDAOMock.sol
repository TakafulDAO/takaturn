// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../interfaces/IWombatRouter.sol";
import "../interfaces/IPool.sol";
import "../interfaces/IWombatLP.sol";
import "../interfaces/IZaynVaultV2TakaoDao.sol";
import "../interfaces/IWETH.sol";
import "./TransferHelper.sol";

contract ZaynZapV2TakaDAOMock is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    mapping(address => bool) public allowedTokens;
    IWombatRouter public WOMBAT_ROUTER;
    IPool public WOMBAT_POOL;
    address public WETH;
    address public poolPath;

    mapping(address => bool) public trustedSenders;

    constructor(IWombatRouter _wombatRouter, IPool _wombatPool, address _poolPath, address _weth) {
        WOMBAT_ROUTER = _wombatRouter;
        WOMBAT_POOL = _wombatPool;
        poolPath = _poolPath;
        WETH = _weth;
    }

    modifier onlyTrustedSender() {
        require(trustedSenders[msg.sender], "only truster senders can call this");
        _;
    }

    /**
     * @dev Rescues random funds stuck that the strat can't handle.
     * @param _token address of the token to rescue.
     */
    function recoverTokens(address _token) external onlyOwner {
        if (_token == address(0)) {
            (bool sent, ) = msg.sender.call{value: address(this).balance}("");
            require(sent, "failed to send");
        } else {
            uint256 amount = IERC20(_token).balanceOf(address(this));
            IERC20(_token).safeTransfer(msg.sender, amount);
        }
    }

    function allowToken(address _token, bool _allow) external onlyOwner {
        allowedTokens[_token] = _allow;
    }

    function toggleTrustedSender(address _trustedSender, bool _allow) external onlyOwner {
        trustedSenders[_trustedSender] = _allow;
    }

    function zapInEth(address vault, uint256 termID) external payable onlyTrustedSender {
        require(msg.value > 0, "Deposit amount should be greater than 0");

        address _lpAddress = IZaynVaultV2TakaoDao(vault).want();
        // address _underlyingToken = IWombatLP(_lpAddress).underlyingToken();

        IWETH(WETH).deposit{value: msg.value}();
        // swapToUnderlying(WETH, _underlyingToken, msg.value); // WETH to underlying
        // uint256 liquidity = addLiquidity(_underlyingToken, msg.value); // underlying to LP
        _approveTokenIfNeeded(_lpAddress, vault); // approve LP to vault
        IZaynVaultV2TakaoDao(vault).depositZap(msg.value, termID); // deposit LP to vault
    }

    function swapToUnderlying(
        address _token,
        address _underlyingToken,
        uint256 _amount
    ) internal returns (uint256 swappedAmount) {
        // address[] memory _path = new address[](2);
        // _path[0] = address(_token);
        // _path[1] = address(_underlyingToken);
        // address[] memory _poolPathArr = new address[](1);
        // _poolPathArr[0] = address(poolPath);
        // (uint256 minDepositOut,) = getAmountOut(_path, _poolPathArr, int256(_amount));
        // _approveTokenIfNeeded(_token, address(WOMBAT_ROUTER));
        // uint256 _before = IERC20(_underlyingToken).balanceOf(address(this));
        // WOMBAT_ROUTER.swapExactTokensForTokens(
        //     _path,
        //     _poolPathArr,
        //     _amount,
        //     minDepositOut,
        //     address(this),
        //     block.timestamp
        // );
        // uint256 _after = IERC20(_underlyingToken).balanceOf(address(this));
        // swappedAmount = _after.sub(_before);
    }

    function addLiquidity(
        address _underlyingToken,
        uint256 depositAmount
    ) internal returns (uint256 liquidity) {
        //  (uint256 minLiq,) = WOMBAT_POOL.quotePotentialDeposit(_underlyingToken, depositAmount);
        // uint256 _slippage = minLiq.mul(5 * 10 ** 15).div((1e18));
        // minLiq =  minLiq.sub(_slippage);
        // _approveTokenIfNeeded(_underlyingToken, address(WOMBAT_POOL));
        // liquidity = WOMBAT_POOL.deposit(
        //     _underlyingToken,
        //     depositAmount,
        //     minLiq,
        //     address(this),
        //     block.timestamp,
        //     false
        // );
    }

    function zapOutETH(
        address vault,
        uint256 _shares,
        uint256 termID
    ) external onlyTrustedSender returns (uint256) {
        require(_shares > 0, "Amount should be greater than 0");
        IZaynVaultV2TakaoDao vaultObj = IZaynVaultV2TakaoDao(vault);
        vaultObj.withdrawZap(_shares, termID);

        // address _lpAddress = IZaynVaultV2TakaoDao(vault).want();
        // address _underlyingToken = IWombatLP(_lpAddress).underlyingToken();
        // uint256 wantBal = IERC20(_lpAddress).balanceOf(address(this));
        // _approveTokenIfNeeded(_lpAddress, address(WOMBAT_POOL));

        // address[] memory _poolPathArr = new address[](1);
        // _poolPathArr[0] = address(poolPath);

        // address[] memory _path = new address[](2);
        // _path[0] = address(_underlyingToken);
        // _path[1] = address(WETH);

        // uint256 withdrawnAmount = WOMBAT_POOL.withdraw(_underlyingToken, wantBal, 0, address(this), block.timestamp);
        // _approveTokenIfNeeded(_underlyingToken, address(WOMBAT_ROUTER));
        // uint256 wethBefore = IERC20(WETH).balanceOf(address(this));
        // WOMBAT_ROUTER.swapExactTokensForTokens(_path, _poolPathArr, withdrawnAmount, 0, address(this), block.timestamp);
        uint256 wethBal = IERC20(WETH).balanceOf(address(this));
        IWETH(WETH).withdraw(wethBal);
        TransferHelper.safeTransferETH(msg.sender, wethBal);
        return wethBal;
    }

    function _approveTokenIfNeeded(address token, address spender) private {
        if (IERC20(token).allowance(address(this), spender) == 0) {
            IERC20(token).safeApprove(spender, type(uint256).max);
        }
    }

    function getAmountOut(
        address[] memory _path,
        address[] memory _poolPathArr,
        int256 _amount
    ) public view returns (uint256 amountOut, uint256[] memory haircuts) {
        return WOMBAT_ROUTER.getAmountOut(_path, _poolPathArr, _amount);
    }

    receive() external payable {
        assert(msg.sender == WETH); // only accept ETH via fallback from the WETH contract
    }
}
