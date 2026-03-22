<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Contracts\Auth\MustVerifyEmail;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, Notifiable;

    protected $fillable = [
        'name', 'email', 'password', 'role', 'status', 'house_id','provider',
        'provider_id','email_verification_token','email_verified_at'
    ];

    protected $hidden = ['password'];

    public function house()
{
    return $this->belongsTo(House::class);
}

public function records()
{
    return $this->hasMany(Record::class, 'added_by');
}

public function paidRecords()
{
    return $this->hasMany(Record::class, 'paid_by');
}

public function joinRequests()
{
    return $this->hasMany(JoinRequest::class);
}
}