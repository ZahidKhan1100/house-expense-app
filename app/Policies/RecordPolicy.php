<?php

namespace App\Policies;

use App\Models\Expense;
use App\Models\Record;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class RecordPolicy
{
public function create(User $user, Expense $expense)
{
    return $user->role === 'admin' || $user->house_id === $expense->house_id;
}

public function update(User $user, Record $record)
{
    return $user->role === 'admin' || $user->id === $record->added_by;
}

public function delete(User $user, Record $record)
{
    return $user->role === 'admin' || $user->id === $record->added_by
        ? \Illuminate\Auth\Access\Response::allow()
        : \Illuminate\Auth\Access\Response::deny('You do not own this record.');
}
}
