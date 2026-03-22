<?php

namespace App\Http\Controllers\Auth;
use App\Http\Controllers\Controller;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

class SocialLoginController extends Controller
{
    public function login($provider, Request $request)
    {
        $socialUser = Socialite::driver($provider)
            ->stateless()
            ->userFromToken($request->token);

        $user = User::firstOrCreate(
            ['email' => strtolower($socialUser->getEmail())],
            [
                'name' => $socialUser->getName(),
                'provider' => $provider,
                'provider_id' => $socialUser->getId(),
                'password' => Hash::make(Str::random(16)),
                'email_verified_at' => now(),
                'status' => 'approved'
            ]
        );

        $token = $user->createToken('mobile')->plainTextToken;

        return [
            'user' => $user,
            'token' => $token
        ];
    }
}