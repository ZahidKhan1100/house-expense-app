<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    protected $fillable = ['house_id', 'name', 'icon'];

    public function house()
    {
        return $this->belongsTo(House::class);
    }
}