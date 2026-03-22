<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SignupRequest;
use App\Http\Requests\LoginRequest;
use App\Actions\Auth\RegisterUser;
use App\Actions\Auth\LoginUser;
use Illuminate\Http\Request;

use App\Models\User;

class AuthController extends Controller
{
    public function signup(SignupRequest $request, RegisterUser $action)
    {
        $result = $action->execute($request->validated());

        return response()->json($result, 201);
    }

    public function login(LoginRequest $request, LoginUser $action)
    {
        $result = $action->execute($request->validated());

        return response()->json($result);
    }

    public function logout()
    {
        auth()->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out'
        ]);
    }

    public function checkEmailVerified(Request $request)
    {
        // Validate the email input
        $request->validate([
            'email' => 'required|email',
        ]);

        // Find user by email
        $user = User::where('email', $request->email)->first();

        // Return JSON response
        return response()->json([
            'email_verified' => $user?->hasVerifiedEmail() ?? false,
        ]);
    }

    
}