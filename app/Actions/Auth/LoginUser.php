<?php

namespace App\Actions\Auth;

use Illuminate\Support\Facades\Auth;

class LoginUser
{
    public function execute(array $data)
    {
        if (!Auth::attempt($data)) {
            abort(401, 'Invalid credentials');
        }



        $user = auth()->user();

        if (!$user->email_verified_at) {
            return response()->json([
                'message' => 'Please verify your email first',
                'email_verified' => false
            ], 403);
        }

        $token = $user->createToken('mobile')->plainTextToken;

        return [
            'token' => $token,
            'user' => $user
        ];
    }
}