<?php 
use App\Models\Response;
use App\Models\AgustusResponse;

function getResponseModel()
{
    $currentMonth = now()->month;
    return ($currentMonth >= 1 && $currentMonth <= 6) 
        ? Response::class 
        : AgustusResponse::class;
}

function getResponseTable()
{
    $currentMonth = now()->month;
    return ($currentMonth >= 1 && $currentMonth <= 6) 
        ? 'responses' 
        : 'agustus_responses';
}

function getViewPath()
{
    $currentMonth = now()->month;
    return ($currentMonth >= 1 && $currentMonth <= 6) 
        ? 'Form/Entri' 
        : 'Form/EntriAgustus';
}