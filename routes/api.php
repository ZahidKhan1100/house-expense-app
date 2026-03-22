<?php

use App\Http\Api\Controllers\SettlementController;
use App\Http\Controllers\Api\InsightsController;
use App\Http\Controllers\Api\MateController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Auth\SocialLoginController;
use App\Http\Controllers\Auth\VerifyEmailController;
use App\Models\User;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\HouseController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\RecordController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\CategoryController;


Route::prefix('v1')->group(function () {

    // Public routes
    Route::post('/signup', [AuthController::class, 'signup']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/verify-email/{token}', [VerifyEmailController::class, 'verify']);
    Route::post('/resend-verification',[VerifyEmailController::class,'resend']);
    Route::post('/check-email-verified', [AuthController::class, 'checkEmailVerified']);

    Route::post('/social-login/{provider}', [SocialLoginController::class, 'login']);

    // Protected routes (require Sanctum token)
    Route::middleware('auth:sanctum')->group(function () {

        Route::post('/logout', [AuthController::class, 'logout']);

        // Houses
        Route::post('/houses/create', [HouseController::class, 'create']);
        Route::post('/houses/join', [HouseController::class, 'join']);
        Route::get('/houses/{house}', [HouseController::class, 'show']);
        // Expenses
        Route::get('/expenses', [ExpenseController::class, 'index']);

        // Records
        Route::post('/records', [RecordController::class, 'store']);      // create
        Route::put('/records/{record}', [RecordController::class, 'update']); // update
        Route::delete('/records/{record}', [RecordController::class, 'destroy']);

        Route::get('/profile', [UserController::class, 'profile']);
        Route::put('/houses/{id}', [HouseController::class, 'update']);
        Route::put('/house/join/qr', [HouseController::class, 'joinByQRCode']);
        Route::get('/house/current', [HouseController::class, 'current']);


        // Dashboard
        Route::get('/dashboard', [DashboardController::class, 'index']);

        Route::get('/mates', [MateController::class, 'index']);
        Route::post('/mates/{id}/approve', [MateController::class, 'approve']);
        Route::post('/mates/{id}/reject', [MateController::class, 'reject']);
        Route::put('/mates/{id}', [MateController::class, 'update']);
        Route::delete('/mates/{id}', [MateController::class, 'destroy']);

        Route::get('/payments/{month?}', [PaymentController::class, 'index']);
        Route::get('/house/{houseId}/insights', [InsightsController::class, 'index']);
        Route::get('/house/current/expenses', [InsightsController::class, 'getExpensesByMonth']);

        // Settlement
        Route::post('/settlements', [SettlementController::class, 'store']);

    });
});


Route::middleware('auth:sanctum')->prefix('v1')->group(function () {
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::post('/categories', [CategoryController::class, 'store']);
    Route::put('/categories/{category}', [CategoryController::class, 'update']);
    Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);
});

