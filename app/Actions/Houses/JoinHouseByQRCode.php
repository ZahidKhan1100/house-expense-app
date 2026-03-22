<?php

namespace App\Actions\House;

use App\Models\House;
use App\Models\User;

class JoinHouseByQRCode
{
    public function execute(User $user, string $code): House
    {
        $house = House::where('code', $code)->firstOrFail();

        //  Direct join (no approval)
        $user->house_id = $house->id;
        $user->status = 'active';
        $user->save();

        return $house;
    }
}