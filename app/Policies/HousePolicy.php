<?php

namespace App\Policies;

use App\Models\House;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class HousePolicy
{
    public function view(User $user, House $house)
{
    return $user->role === 'admin' || $user->house_id === $house->id;
}

public function update(User $user, House $house)
{
    return $user->role === 'admin';
}

public function join(User $user, House $house)
{
    return $user->role === 'mate';
}
}
