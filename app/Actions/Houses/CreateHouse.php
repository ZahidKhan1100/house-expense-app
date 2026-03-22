<?php

namespace App\Actions\Houses;

use App\Models\House;
use Illuminate\Support\Str;

class CreateHouse
{
    public function handle($user, array $data)
    {
        $house = House::create([
            'name' => $data['name'],
            'currency' => $data['currency'] ?? '$',
            'admin_id' => $user->id,
            'code' => strtoupper(Str::random(6))
        ]);

        $user->update([
            'house_id' => $house->id,
            'role' => 'admin',
            'status' => 'admin'
        ]);

        return $house;
    }
}