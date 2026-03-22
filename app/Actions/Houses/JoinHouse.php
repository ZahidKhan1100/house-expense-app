<?php

namespace App\Actions\Houses;

use App\Models\House;

class JoinHouse
{
    public function handle($user, string $code)
    {
        $house = House::where('code', strtoupper($code))->firstOrFail();

        $house->joinRequests()->create([
            'user_id' => $user->id
        ]);

        return [
            'message' => 'Join request sent'
        ];
    }
}