<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Expense extends Model
{
    protected $fillable = ['house_id', 'month'];

    public function house()
    {
        return $this->belongsTo(House::class);
    }

    public function records(): HasMany
    {
        return $this->hasMany(Record::class);
    }

   
}