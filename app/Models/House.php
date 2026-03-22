<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class House extends Model
{
    protected $fillable = ['name', 'code', 'admin_id', 'currency'];

    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    public function mates()
    {
        return $this->hasMany(User::class, 'house_id');
    }

    public function records()
{
    return $this->hasManyThrough(Record::class, Expense::class);
}

    public function categories()
    {
        return $this->hasMany(Category::class);
    }

    public function expenses()
    {
        return $this->hasMany(Expense::class);
    }

    public function joinRequests()
    {
        return $this->hasMany(JoinRequest::class);
    }

     
}