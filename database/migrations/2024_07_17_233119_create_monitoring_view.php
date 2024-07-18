<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement("CREATE VIEW `monitoring` AS select `metasak`.`regions`.`id` AS `id`,`metasak`.`regions`.`provinsi` AS `provinsi`,`metasak`.`regions`.`nama_provinsi` AS `nama_provinsi`,`metasak`.`regions`.`kabupaten` AS `kabupaten`,`metasak`.`regions`.`nama_kabupaten` AS `nama_kabupaten`,`metasak`.`regions`.`kecamatan` AS `kecamatan`,`metasak`.`regions`.`nama_kecamatan` AS `nama_kecamatan`,`metasak`.`regions`.`desa` AS `desa`,`metasak`.`regions`.`nama_desa` AS `nama_desa`,`metasak`.`regions`.`klasifikasi` AS `klasifikasi`,`metasak`.`regions`.`nbs` AS `nbs`,`metasak`.`regions`.`nks` AS `nks`,`metasak`.`regions`.`sak` AS `sak`,`metasak`.`regions`.`jumlah_keluarga` AS `jumlah_keluarga`,`metasak`.`regions`.`jml_sampel` AS `jml_sampel`,`metasak`.`regions`.`sumber_data` AS `sumber_data`,`b`.`region_id` AS `region_id`,`b`.`pml` AS `pml`,`b`.`jumlah_entri` AS `jumlah_entri` from (`metasak`.`regions` left join (select `c`.`region_id` AS `region_id`,`c`.`pml` AS `pml`,count(0) AS `jumlah_entri` from (select `metasak`.`responses`.`region_id` AS `region_id`,`metasak`.`responses`.`nurt` AS `nurt`,`metasak`.`responses`.`pml` AS `pml` from `metasak`.`responses` group by `metasak`.`responses`.`region_id`,`metasak`.`responses`.`nurt`,`metasak`.`responses`.`pml`) `c` group by `c`.`region_id`,`c`.`pml`) `b` on(`metasak`.`regions`.`id` = `b`.`region_id`))");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("DROP VIEW IF EXISTS `monitoring`");
    }
};
