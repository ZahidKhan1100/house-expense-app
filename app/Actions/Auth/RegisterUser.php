<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Models\House;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use App\Mail\VerifyEmail;
use Laravel\Sanctum\HasApiTokens;

class RegisterUser
{
    public function execute(array $data)
    {
        // Create user
        $user = User::create([
            'name' => $data['name'],
            'email' => strtolower($data['email']),
            'password' => Hash::make($data['password']),
            'role' => 'mate',       // default role
            'status' => 'pending',  // will update if joining a house
            'email_verification_token' => Str::random(60),
        ]);

        // Send verification email
        Mail::to($user->email)->send(new VerifyEmail($user));

        /**
         * JOIN EXISTING HOUSE (via code or QR)
         */
        if (!empty($data['house_code'])) {

            $house = House::where('code', strtoupper($data['house_code']))->firstOrFail();

            // Directly join house, no admin approval
            $user->update([
                'house_id' => $house->id,
                'role' => 'mate',
                'status' => 'approved' // user can use house immediately
            ]);

            return [
                'message' => 'Joined house successfully. Please verify your email.',
                'email_verified' => false,
                'user' => $user
            ];
        }

        /**
         * CREATE NEW HOUSE
         */
        $house = House::create([
            'name' => $user->name . "'s House",
            'code' => strtoupper(Str::random(6)),
            'admin_id' => $user->id,
            'currency' => '$'
        ]);

        $user->update([
            'house_id' => $house->id,
            'role' => 'admin',
            'status' => 'admin'
        ]);

        /**
         * DEFAULT CATEGORIES
         */
        $defaultCategories = [
            ['name' => 'Grocery', 'icon' => 'shopping-basket'],
            ['name' => 'Rent', 'icon' => 'home'],
        ];

        foreach ($defaultCategories as $cat) {
            $house->categories()->create($cat);
        }
        $token = $user->createToken('auth_token')->plainTextToken;

        return [
            'message' => 'Account and house created. Please verify your email.',
            'email_verified' => false,
            'token' => $token,
            'user' => $user
        ];
    }
}